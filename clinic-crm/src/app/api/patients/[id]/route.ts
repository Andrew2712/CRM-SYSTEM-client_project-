/**
 * src/app/api/patients/[id]/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Phase, PatientStatus, Gender } from "@prisma/client";
import { rateLimitRead, rateLimitWrite, rateLimitResponse } from "@/lib/rateLimit";
import { auditLog } from "@/lib/audit";
import { requireAuth, requireRole } from "@/lib/rbac";
import type { AuthSession } from "@/lib/rbac";
import { validate, CreatePatientSchema } from "@/lib/validation";

// ── Helper: enforce access to a specific patient ──────────────────────────────
async function assertCanAccessPatient(
  patientId: string,
  session: AuthSession
): Promise<void> {
  const role = session.user.role as string;

  // ADMIN and RECEPTIONIST see all patients
  if (role === "ADMIN" || role === "RECEPTIONIST") return;

  // PATIENT can only see their own record
  if (role === "PATIENT") {
    if (session.user.id !== patientId) {
      throw NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return;
  }

  // DOCTOR can only see patients they have (or had) an appointment with
  if (role === "DOCTOR") {
    const link = await prisma.appointment.findFirst({
      where: { patientId, doctorId: session.user.id },
      select: { id: true },
    });
    if (!link) {
      throw NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return;
  }

  // Unknown role — deny
  throw NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ── GET /api/patients/[id] ────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rl = await rateLimitRead(_req);
  if (!rl.success) return rateLimitResponse(rl);

  let session: AuthSession;
  try {
    session = await requireAuth();
  } catch (err) {
    return err as NextResponse;
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  try {
    await assertCanAccessPatient(id, session);
  } catch (err) {
    return err as NextResponse;
  }

  const patient = await prisma.patient.findUnique({
    where: { id, isActive: true },
    include: {
      appointments: {
        orderBy: { startTime: "desc" },
        include: { doctor: true },
      },
      visits: {
        orderBy: { visitDate: "desc" },
        include: { appointment: true },
      },
    },
  });

  if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(patient);
}

// ── PATCH /api/patients/[id] ──────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rl = await rateLimitWrite(req);
  if (!rl.success) return rateLimitResponse(rl);

  let session: AuthSession;
  try {
    session = await requireAuth();
    requireRole(session, ["ADMIN", "RECEPTIONIST", "DOCTOR"]);
  } catch (err) {
    return err as NextResponse;
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  try {
    await assertCanAccessPatient(id, session);
  } catch (err) {
    return err as NextResponse;
  }

  const body = await req.json();

  const partial = CreatePatientSchema.partial();
  const result = partial.safeParse(body);
  if (!result.success) {
    const messages = result.error.issues.map((e) => e.message).join("; ");
    return NextResponse.json({ error: messages }, { status: 400 });
  }

  const existing = await prisma.patient.findUnique({ where: { id } });
  if (!existing || !existing.isActive)
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  // Explicitly cast enum fields; spread the rest as-is
  const { phase, gender, status, ...rest } = result.data;

  const updated = await prisma.patient.update({
    where: { id },
    data: {
      ...rest,
      ...(phase  !== undefined && { phase:  phase  as Phase }),
      ...(gender !== undefined && { gender: gender as Gender }),
      ...(status !== undefined && { status: status as PatientStatus }),
    },
  });

  await auditLog({
    session,
    req,
    action:      "UPDATE",
    entity:      "Patient",
    entityId:    id,
    description: `Updated patient "${updated.name}"`,
    oldValue:    existing,
    newValue:    updated,
  });

  return NextResponse.json(updated);
}

// ── DELETE /api/patients/[id] (soft delete) ───────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rl = await rateLimitWrite(req);
  if (!rl.success) return rateLimitResponse(rl);

  let session: AuthSession;
  try {
    session = await requireAuth();
    requireRole(session, ["ADMIN"]);
  } catch (err) {
    return err as NextResponse;
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const existing = await prisma.patient.findUnique({ where: { id } });
  if (!existing || !existing.isActive)
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  const deleted = await prisma.patient.update({
    where: { id },
    data: { isActive: false, deletedAt: new Date() },
  });

  await auditLog({
    session,
    req,
    action:      "DELETE",
    entity:      "Patient",
    entityId:    id,
    description: `Soft-deleted patient "${existing.name}"`,
    oldValue:    existing,
  });

  return NextResponse.json({ success: true, id: deleted.id });
}