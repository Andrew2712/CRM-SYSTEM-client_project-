import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Phase, PatientStatus, Gender } from "@prisma/client";

// ── GET — Single patient with appointments & visits ───────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const patient = await prisma.patient.findUnique({
    where: { id },
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

// ── PATCH — Update patient fields ─────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!["ADMIN", "DOCTOR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const patient = await prisma.patient.update({
      where: { id },
      data: {
        ...(body.name !== undefined               ? { name: body.name as string }                                   : {}),
        ...(body.phone !== undefined              ? { phone: body.phone as string }                                 : {}),
        ...(body.email !== undefined              ? { email: body.email as string }                                 : {}),
        ...(body.age !== undefined                ? { age: parseInt(body.age as string, 10) }                       : {}),
        ...(body.gender !== undefined             ? { gender: body.gender as Gender }                               : {}),
        ...(body.address !== undefined            ? { address: body.address as string }                             : {}),
        ...(body.purposeOfVisit !== undefined     ? { purposeOfVisit: body.purposeOfVisit as string }               : {}),
        ...(body.medicalConditions !== undefined  ? { medicalConditions: body.medicalConditions as string }         : {}),
        ...(body.status !== undefined             ? { status: body.status as PatientStatus }                        : {}),
        ...(body.phase !== undefined              ? { phase: body.phase as Phase }                                  : {}),
        ...(body.totalSessionsPlanned !== undefined ? { totalSessionsPlanned: Number(body.totalSessionsPlanned) }   : {}),
      },
    });

    return NextResponse.json(patient);
  } catch (err: unknown) {
    const prismaErr = err as { code?: string };
    if (prismaErr.code === "P2025") {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }
    console.error("Update patient error:", err);
    return NextResponse.json({ error: "Failed to update patient" }, { status: 500 });
  }
}

// ── DELETE — Admin only ───────────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only admins can delete patients" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await prisma.notification.deleteMany({ where: { appointment: { patientId: id } } });
    await prisma.patientVisit.deleteMany({ where: { patientId: id } });
    await prisma.appointment.deleteMany({ where: { patientId: id } });
    await prisma.patient.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const prismaErr = err as { code?: string };
    if (prismaErr.code === "P2025") {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }
    console.error("Delete patient error:", err);
    return NextResponse.json({ error: "Failed to delete patient" }, { status: 500 });
  }
}