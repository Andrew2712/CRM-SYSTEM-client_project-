import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();

  // Today's range
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  // This week's range (Mon–Sun)
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const [
    allPatients,
    todayAppointments,
    missedWeekCount,
    recentAppointments,
    weekAppointments,
  ] = await Promise.all([
    // All patients with appointment count
    prisma.patient.findMany({
      select: {
        id: true,
        name: true,
        patientCode: true,
        status: true,
        _count: { select: { appointments: true } },
      },
      orderBy: { createdAt: "desc" },
    }),

    // Today's appointments
    prisma.appointment.findMany({
      where: { startTime: { gte: todayStart, lte: todayEnd } },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            patientCode: true,
            status: true,
            _count: { select: { appointments: true } },
          },
        },
        doctor: { select: { name: true } },
      },
      orderBy: { startTime: "asc" },
    }),

    // Missed appointments this week
    prisma.appointment.count({
      where: {
        status: "MISSED",
        startTime: { gte: weekStart, lt: weekEnd },
      },
    }),

    // Recent appointments (last 20)
    prisma.appointment.findMany({
      take: 20,
      orderBy: { startTime: "desc" },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            patientCode: true,
            status: true,
            _count: { select: { appointments: true } },
          },
        },
        doctor: { select: { name: true } },
      },
    }),

    // This week's appointments for bar chart (Mon–Sun)
    prisma.appointment.findMany({
      where: { startTime: { gte: weekStart, lt: weekEnd } },
      select: { startTime: true },
    }),
  ]);

  // Build weekCounts[0..6] = Mon..Sun
  const weekCounts = Array(7).fill(0);
  for (const appt of weekAppointments) {
    const day = (new Date(appt.startTime).getDay() + 6) % 7; // Mon=0
    weekCounts[day]++;
  }

  const totalPatients = allPatients.length;
  const newPatients = allPatients.filter((p) => p.status === "NEW").length;
  const returningPatients = allPatients.filter((p) => p.status === "RETURNING").length;

  return NextResponse.json({
    totalPatients,
    newPatients,
    returningPatients,
    todayTotal: todayAppointments.length,
    missedWeek: missedWeekCount,
    confirmedUpcoming: todayAppointments.filter((a) => a.status === "CONFIRMED").length,
    todayAppointments,
    recentAppointments,
    weekCounts,
    allPatients,
  });
}