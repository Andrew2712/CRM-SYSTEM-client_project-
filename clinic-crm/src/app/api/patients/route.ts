import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Gender, Phase, PatientStatus } from "@prisma/client";

// ── Helper: collision-resistant patient code ──────────────────────────────────
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

// ── GET — List all patients ───────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const search = req.nextUrl.searchParams.get("search") ?? "";
  const status = req.nextUrl.searchParams.get("status") ?? "";

  const patients = await prisma.patient.findMany({
    where: {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
              { patientCode: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(status ? { status: status as PatientStatus } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { appointments: true } },
      appointments: {
        orderBy: { startTime: "desc" },
        take: 1,
        select: { startTime: true },
      },
    },
  });

  return NextResponse.json(patients);
}

// ── POST — Create a new patient ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!body.phone || typeof body.phone !== "string") {
    return NextResponse.json({ error: "phone is required" }, { status: 400 });
  }

  // Check duplicate phone
  const existing = await prisma.patient.findUnique({ where: { phone: body.phone as string } });
  if (existing) {
    return NextResponse.json(
      { error: "Patient with this phone already exists", existing },
      { status: 409 }
    );
  }

  // Retry up to 5 times to handle rare simultaneous-request collisions
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const patientCode = await generatePatientCode();

      const patient = await prisma.patient.create({
        data: {
          patientCode,
          name:              body.name as string,
          phone:             body.phone as string,
          email:             (body.email as string)  || null,
          age:               body.age ? parseInt(body.age as string, 10) : null,
          gender:            (body.gender as Gender) || null,
          address:           (body.address as string) || null,
          purposeOfVisit:    (body.purposeOfVisit as string) || null,
          medicalConditions: (body.medicalConditions as string) || null,
          status:            (body.status as PatientStatus) || PatientStatus.NEW,
          phase:             (body.phase as Phase) || Phase.PHASE_1,
          totalSessionsPlanned: body.totalSessionsPlanned
            ? parseInt(body.totalSessionsPlanned as string, 10)
            : 0,
        },
      });

      return NextResponse.json(patient, { status: 201 });
    } catch (err: unknown) {
      const prismaErr = err as { code?: string };

      // P2002 = unique constraint violation — retry with a fresh code
      if (prismaErr.code === "P2002" && attempt < 4) {
        continue;
      }

      console.error("Create patient error:", err);
      return NextResponse.json({ error: "Failed to create patient" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Failed to generate a unique patient code" }, { status: 500 });
}