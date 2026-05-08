/**
 * GET /api/patient/me
 * Returns the authenticated patient's full profile.
 * PATIENT role only.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "PATIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const patient = await prisma.patient.findUnique({
    where: { id: session.user.id },
    include: {
      appointments: {
        orderBy: { startTime: "desc" },
        include: { doctor: { select: { name: true } } },
      },
      visits: {
        orderBy: { visitDate: "desc" },
        include: { appointment: { select: { id: true } } },
      },
    },
  });

  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const { passwordHash: _pw, ...safePatient } = patient;
  return NextResponse.json(safePatient);
}
