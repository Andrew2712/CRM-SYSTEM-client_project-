import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Phase, PatientStatus, Gender } from "@prisma/client";
import { rateLimitRead, rateLimitWrite, rateLimitResponse, getClientIp } from "@/lib/rateLimit";
import { auditLog } from "@/lib/audit";
import type { AuthSession } from "@/lib/rbac";

function buildSession(session: Awaited<ReturnType<typeof getServerSession>>): AuthSession {
  return session as AuthSession;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = await rateLimitRead(_req);
  if (!rl.success) return rateLimitResponse(rl);

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      appointments: { orderBy: { startTime: "desc" }, include: { doctor: true } },
      visits:       { orderBy: { visitDate: "desc" },  include: { appointment: true } },
    },
  });
  if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(patient);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = await rateLimitWrite(req);
  if (!rl.success) return rateLimitResponse(rl);

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role          = session.user.role;
  const canEditBasic    = ["ADMIN", "DOCTOR", "RECEPTIONIST"].includes(role);
  const canEditClinical = ["ADMIN", "DOCTOR"].includes(role);
  if (!canEditBasic) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  try {
    const before = await prisma.patient.findUnique({ where: { id }, select: { name: true, phone: true, email: true, status: true, phase: true } });
    const data: Record<string, unknown> = {};

    if (body.name            !== undefined) data.name            = body.name;
    if (body.phone           !== undefined) data.phone           = body.phone;
    if (body.age             !== undefined) data.age             = Number(body.age);
    if (body.gender          !== undefined) data.gender          = body.gender as Gender;
    if (body.address         !== undefined) data.address         = body.address;
    if (body.purposeOfVisit  !== undefined) data.purposeOfVisit  = body.purposeOfVisit;
    if (body.email !== undefined && role === "ADMIN") data.email = body.email;

    if (canEditClinical) {
      if (body.medicalConditions    !== undefined) data.medicalConditions    = body.medicalConditions;
      if (body.status               !== undefined) data.status               = body.status as PatientStatus;
      if (body.phase                !== undefined) data.phase                = (body.phase || null) as Phase | null;
      if (body.totalSessionsPlanned !== undefined) data.totalSessionsPlanned = Number(body.totalSessionsPlanned);
    }

    const patient = await prisma.patient.update({
      where: { id }, data,
      include: {
        appointments: { orderBy: { startTime: "desc" }, include: { doctor: true } },
        visits:       { orderBy: { visitDate: "desc" }, include: { appointment: true } },
      },
    });

    // ── Audit ──
    await auditLog({
      session:     buildSession(session),
      req,
      action:      "UPDATE",
      entity:      "Patient",
      entityId:    id,
      description: `Updated patient record for "${patient.name}"`,
      oldValue:    before as Record<string, unknown>,
      newValue:    data,
    });

    return NextResponse.json(patient);
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "P2025") return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    console.error(err);
    return NextResponse.json({ error: "Failed to update patient" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = await rateLimitWrite(_req);
  if (!rl.success) return rateLimitResponse(rl);

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Only admins can delete patients" }, { status: 403 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  try {
    const patient = await prisma.patient.findUnique({ where: { id }, select: { id: true, name: true, isActive: true } });
    if (!patient)          return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    if (!patient.isActive) return NextResponse.json({ error: "Patient is already deactivated" }, { status: 409 });

    const deactivated = await prisma.patient.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
      select: { id: true, name: true, patientCode: true, isActive: true, deletedAt: true },
    });

    await auditLog({
      session:     buildSession(session),
      req:         _req,
      action:      "DELETE",
      entity:      "Patient",
      entityId:    id,
      description: `Deactivated patient "${deactivated.name}"`,
      oldValue:    { isActive: true },
      newValue:    { isActive: false },
    });

    return NextResponse.json({ message: `Patient "${deactivated.name}" has been deactivated.`, patient: deactivated });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "P2025") return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    console.error(err);
    return NextResponse.json({ error: "Failed to deactivate patient" }, { status: 500 });
  }
}
