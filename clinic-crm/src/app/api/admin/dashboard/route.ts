/**
 * src/app/api/admin/dashboard/route.ts
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/rbac";
import { enrichWithActivity } from "@/lib/patientActivity";

export async function GET() {
  let session;
  try {
    session = await requireAuth();
    requireRole(session, ["ADMIN"]);
  } catch (err) {
    return err as NextResponse;
  }

  try {
    const now = new Date();

    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const [
      allActivePatients,        // ✅ active patients only
      todayAppointments,
      missedWeekCount,
      cancelledWeekCount,
      recentAppointments,
      weekAppointments,
    ] = await Promise.all([

      // ✅ isActive: true — deactivated patients are excluded from all counts
      prisma.patient.findMany({
        where: { isActive: true },
        select: {
          id: true, name: true, patientCode: true, status: true, createdAt: true,
          _count: { select: { appointments: true } },
          appointments: {
            where: { status: "ATTENDED" },
            orderBy: { startTime: "desc" },
            take: 1,
            select: { startTime: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),

      // Appointments — full history, no isActive filter needed here
      prisma.appointment.findMany({
        where: { startTime: { gte: todayStart, lte: todayEnd } },
        orderBy: { startTime: "asc" },
        include: {
          patient: {
            select: {
              id: true, name: true, patientCode: true, status: true,
              _count: { select: { appointments: true } },
            },
          },
          doctor: { select: { id: true, name: true } },
        },
      }),

      prisma.appointment.count({
        where: { status: "MISSED", startTime: { gte: weekStart, lt: weekEnd } },
      }),
      prisma.appointment.count({
        where: { status: "CANCELLED", startTime: { gte: weekStart, lt: weekEnd } },
      }),

      prisma.appointment.findMany({
        take: 20,
        orderBy: { startTime: "desc" },
        include: {
          patient: {
            select: {
              id: true, name: true, patientCode: true, status: true,
              _count: { select: { appointments: true } },
            },
          },
          doctor: { select: { id: true, name: true } },
        },
      }),

      prisma.appointment.findMany({
        where: {
          startTime: { gte: weekStart, lt: weekEnd },
          status: { not: "CANCELLED" },
        },
        select: { startTime: true },
      }),
    ]);

    const weekCounts = Array(7).fill(0);
    for (const appt of weekAppointments) {
      const day = (new Date(appt.startTime).getDay() + 6) % 7;
      weekCounts[day]++;
    }

    const enrichedPatients = enrichWithActivity(allActivePatients);

    const todayActive       = todayAppointments.filter(a => a.status !== "CANCELLED");
    const todayTotal        = todayActive.length;
    const cancelledToday    = todayAppointments.length - todayActive.length;
    const attendedToday     = todayAppointments.filter(a => a.status === "ATTENDED").length;
    const missedToday       = todayAppointments.filter(a => a.status === "MISSED").length;
    const confirmedUpcoming = todayAppointments.filter(
      a => a.status === "CONFIRMED" || a.status === "RESCHEDULED",
    ).length;

    return NextResponse.json({
      // ✅ All patient counts reflect active patients only
      totalPatients:     enrichedPatients.length,
      newPatients:       enrichedPatients.filter(p => p.status === "NEW").length,
      returningPatients: enrichedPatients.filter(p => p.status === "RETURNING").length,
      activePatients:    enrichedPatients.filter(p => p.activityStatus === "ACTIVE").length,
      inactivePatients:  enrichedPatients.filter(p => p.activityStatus === "INACTIVE").length,

      todayTotal,
      attendedToday,
      missedToday,
      cancelledToday,
      confirmedUpcoming,

      missedWeek:    missedWeekCount,
      cancelledWeek: cancelledWeekCount,

      todayAppointments,
      recentAppointments,
      weekCounts,
      allPatients: enrichedPatients,
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard data" },
      { status: 500 },
    );
  }
}