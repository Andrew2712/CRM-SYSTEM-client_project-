import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (!["DOCTOR", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Only doctors and admins can update session status" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { status, notes } = body;

  if (!["ATTENDED", "MISSED", "CONFIRMED", "CANCELLED"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const appointment = await prisma.appointment.update({
    where: { id },
    data: {
      status,
      ...(notes !== undefined ? {} : {}),
    },
    include: { patient: true, doctor: true },
  });

  // Create visit record if attended
  if (status === "ATTENDED") {
    await prisma.patientVisit.upsert({
      where: { appointmentId: id },
      update: { status, notes: notes ?? null },
      create: {
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        appointmentId: id,
        sessionType: appointment.sessionType,
        status,
        visitDate: appointment.startTime,
        notes: notes ?? null,
      },
    });
    // Update patient to RETURNING
    await prisma.patient.update({
      where: { id: appointment.patientId },
      data: { status: "RETURNING" },
    });
  }

  return NextResponse.json(appointment);
}