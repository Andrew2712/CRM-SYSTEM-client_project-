/**
 * src/app/api/patients/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * GET  /api/patients  — list patients (RBAC + activityStatus)
 * POST /api/patients — create a new patient
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Gender, Phase, PatientStatus } from "@prisma/client";
import { requireAuth, getPatientFilter } from "@/lib/rbac";
import { fetchPatientsWithActivity } from "@/lib/patientActivity";
import bcrypt from "bcryptjs";

// ─────────────────────────────────────────────────────────────────────────────
// ✅ Helper: collision-safe patient code generator
// ─────────────────────────────────────────────────────────────────────────────
async function generatePatientCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PHY-${year}-`;

  const last = await prisma.patient.findFirst({
    where: { patientCode: { startsWith: prefix } },
    orderBy: { patientCode: "desc" },
    select: { patientCode: true },
  });

  const nextNumber = last
    ? parseInt(last.patientCode.replace(prefix, ""), 10) + 1
    : 1;

  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ✅ GET: Patients (RBAC + search + computed activity)
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    return err as NextResponse;
  }

  try {
    const searchTerm = req.nextUrl.searchParams.get("search") ?? "";
    const statusFilter = req.nextUrl.searchParams.get("status") ?? "";

    // RBAC filter (doctor sees only their patients)
    const rbacScope = getPatientFilter(session);

    // Optimized query with computed activityStatus
    const patients = await fetchPatientsWithActivity({
      where: rbacScope,
      searchTerm,
      statusFilter,
    });

    return NextResponse.json(patients);
  } catch (error) {
    console.error("GET /patients error:", error);
    return NextResponse.json(
      { error: "Failed to fetch patients" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ✅ POST: Create Patient (RBAC + validation + retry-safe)
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    return err as NextResponse;
  }

  // ❗ Restrict doctors
  if (session.user.role === "DOCTOR") {
    return NextResponse.json(
      { error: "Doctors are not permitted to create patient records" },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // ✅ Validation
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 }
    );
  }

  if (!body.phone || typeof body.phone !== "string") {
    return NextResponse.json(
      { error: "phone is required" },
      { status: 400 }
    );
  }

  try {
    // ✅ Duplicate phone check
    const existing = await prisma.patient.findUnique({
      where: { phone: body.phone as string },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Patient with this phone already exists", existing },
        { status: 409 }
      );
    }

    // ✅ Retry loop for patientCode collision
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const patientCode = await generatePatientCode();

        // ── Auto-generate patient login credentials ──────────────────────
        // Username: patient email (if provided)
        // Password: FirstName_YYYY-MM-DD  (using today's registration date)
        const registrationDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const firstName = (body.name as string).trim().split(/\s+/)[0];
        const rawPassword = `${firstName}_${registrationDate}`;
        const passwordHash = await bcrypt.hash(rawPassword, 10);

        const patient = await prisma.patient.create({
          data: {
            patientCode,
            name: body.name as string,
            phone: body.phone as string,
            email: (body.email as string) || null,
            age: body.age ? parseInt(body.age as string, 10) : null,
            gender: (body.gender as Gender) || null,
            address: (body.address as string) || null,
            purposeOfVisit: (body.purposeOfVisit as string) || null,
            medicalConditions: (body.medicalConditions as string) || null,
            status:
              (body.status as PatientStatus) || PatientStatus.NEW,
            phase: (body.phase as Phase) || null,
            totalSessionsPlanned: body.totalSessionsPlanned
              ? parseInt(body.totalSessionsPlanned as string, 10)
              : 0,
            passwordHash: body.email ? passwordHash : null,
          },
        });

        return NextResponse.json(
          {
            ...patient,
            _credentials: body.email
              ? { username: body.email, defaultPassword: rawPassword }
              : null,
          },
          { status: 201 }
        );
      } catch (err: unknown) {
        const prismaErr = err as { code?: string };

        // Retry on unique constraint collision
        if (prismaErr.code === "P2002" && attempt < 4) {
          continue;
        }

        console.error("Create patient error:", err);
        return NextResponse.json(
          { error: "Failed to create patient" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to generate a unique patient code" },
      { status: 500 }
    );
  } catch (error) {
    console.error("POST /patients error:", error);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}