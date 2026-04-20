import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const appointments = await prisma.appointment.findMany({
    orderBy: { startTime: "desc" },
    take: 20,
    include: { patient: true, doctor: true },
  });
  return NextResponse.json(appointments);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

   const body = await req.json();
   const { id, status } = body;

  // Check slot not already booked
  const conflict = await prisma.appointment.findFirst({
    where: {
      doctorId: body.doctorId,
      startTime: new Date(body.startTime),
      status: { in: ["CONFIRMED", "ATTENDED"] },
    },
  });
  if (conflict) return NextResponse.json({ error: "This slot is already booked for this doctor" }, { status: 409 });

  const appointment = await prisma.appointment.create({
    data: {
      patientId: body.patientId,
      doctorId: body.doctorId,
      sessionType: body.sessionType,
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
      status: "CONFIRMED",
    },
    include: { patient: true, doctor: true },
  });

  // Update patient to RETURNING if they have previous appointments
  const apptCount = await prisma.appointment.count({ where: { patientId: body.patientId } });
  if (apptCount > 1) {
    await prisma.patient.update({ where: { id: body.patientId }, data: { status: "RETURNING" } });
  }

  
  return NextResponse.json(appointment);
}