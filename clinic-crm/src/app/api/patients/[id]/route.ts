import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Phase, PatientStatus, Gender } from "@prisma/client";

// ── GET ─────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

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

  if (!patient) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(patient);
}

// ── PATCH ───────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;

  // RECEPTIONIST can edit basic patient profile fields (name, phone, address, etc.)
  // ADMIN and DOCTOR can edit everything including phase, sessions, medical data
  const canEditBasic    = ["ADMIN", "DOCTOR", "RECEPTIONIST"].includes(role);
  const canEditClinical = ["ADMIN", "DOCTOR"].includes(role);

  if (!canEditBasic) {
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
    const data: Record<string, unknown> = {};

    // Fields any allowed role can update
    if (body.name  !== undefined) data.name  = body.name;
    if (body.phone !== undefined) data.phone = body.phone;
    if (body.age   !== undefined) data.age   = Number(body.age);
    if (body.gender  !== undefined) data.gender  = body.gender as Gender;
    if (body.address !== undefined) data.address = body.address;
    if (body.purposeOfVisit !== undefined) data.purposeOfVisit = body.purposeOfVisit;

    // Email: only ADMIN can update
    if (body.email !== undefined && role === "ADMIN") {
      data.email = body.email;
    }

    // Clinical fields: only ADMIN and DOCTOR
    if (canEditClinical) {
      if (body.medicalConditions !== undefined) data.medicalConditions = body.medicalConditions;
      if (body.status            !== undefined) data.status            = body.status as PatientStatus;
      if (body.phase             !== undefined) data.phase             = (body.phase || null) as Phase | null;
      if (body.totalSessionsPlanned !== undefined) {
        data.totalSessionsPlanned = Number(body.totalSessionsPlanned);
      }
    }

    const patient = await prisma.patient.update({
      where: { id },
      data,
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

    return NextResponse.json(patient);
  } catch (err: any) {
    if (err.code === "P2025") {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to update patient" }, { status: 500 });
  }
}

// ── DELETE ──────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  } catch (err: any) {
    if (err.code === "P2025") {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to delete patient" }, { status: 500 });
  }
}