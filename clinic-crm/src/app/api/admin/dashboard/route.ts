/**
 * src/app/api/admin/dashboard/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/admin/dashboard
 *
 * Returns:
 * - Patient stats (NEW / RETURNING / ACTIVE / INACTIVE)
 * - Today's appointments
 * - Weekly stats
 * - Recent activity
 *
 * Access: ADMIN only
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/rbac";
import { enrichWithActivity } from "@/lib/patientActivity";

export async function GET() {
  // ─────────────────────────────────────────────────────────────
  // 1️⃣ Auth + Role Guard
  // ─────────────────────────────────────────────────────────────
  let session;
  try {
    session = await requireAuth();
    requireRole(session, ["ADMIN"]);
  } catch (err) {
    return err as NextResponse;
  }

  try {
    const now = new Date();

    // ─────────────────────────────────────────────────────────────
    // 2️⃣ Date Ranges
    // ─────────────────────────────────────────────────────────────
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    // ─────────────────────────────────────────────────────────────
    // 3️⃣ Parallel Queries (Optimized 🚀)
    // ─────────────────────────────────────────────────────────────
    const [
      allPatients,
      todayAppointments,
      missedWeekCount,
      recentAppointments,
      weekAppointments,
    ] = await Promise.all([
      // ✅ All patients (with last attended appointment for activity)
      prisma.patient.findMany({
        select: {
          id: true,
          name: true,
          patientCode: true,
          status: true,
          createdAt: true,

          _count: {
            select: { appointments: true },
          },

          // ⚡ Required for activity computation
          appointments: {
            where: { status: "ATTENDED" },
            orderBy: { startTime: "desc" },
            take: 1,
            select: { startTime: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),

      // ✅ Today's appointments
      prisma.appointment.findMany({
        where: {
          startTime: { gte: todayStart, lte: todayEnd },
        },
        orderBy: { startTime: "asc" },
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
          doctor: {
            select: { id: true, name: true },
          },
        },
      }),

      // ✅ Missed this week
      prisma.appointment.count({
        where: {
          status: "MISSED",
          startTime: { gte: weekStart, lt: weekEnd },
        },
      }),

      // ✅ Recent activity
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
          doctor: {
            select: { id: true, name: true },
          },
        },
      }),

      // ✅ Weekly breakdown
      prisma.appointment.findMany({
        where: {
          startTime: { gte: weekStart, lt: weekEnd },
        },
        select: { startTime: true },
      }),
    ]);

    // ─────────────────────────────────────────────────────────────
    // 4️⃣ Weekly Chart Data (Mon → Sun)
    // ─────────────────────────────────────────────────────────────
    const weekCounts = Array(7).fill(0);

    for (const appt of weekAppointments) {
      const day = (new Date(appt.startTime).getDay() + 6) % 7;
      weekCounts[day]++;
    }

    // ─────────────────────────────────────────────────────────────
    // 5️⃣ Enrich Patients with Activity
    // ─────────────────────────────────────────────────────────────
    const enrichedPatients = enrichWithActivity(allPatients);

    // ─────────────────────────────────────────────────────────────
    // 6️⃣ Patient Metrics
    // ─────────────────────────────────────────────────────────────
    const totalPatients = enrichedPatients.length;

    const newPatients = enrichedPatients.filter(
      (p) => p.status === "NEW"
    ).length;

    const returningPatients = enrichedPatients.filter(
      (p) => p.status === "RETURNING"
    ).length;

    const activePatients = enrichedPatients.filter(
      (p) => p.activityStatus === "ACTIVE"
    ).length;

    const inactivePatients = enrichedPatients.filter(
      (p) => p.activityStatus === "INACTIVE"
    ).length;

    // ─────────────────────────────────────────────────────────────
    // 7️⃣ Response
    // ─────────────────────────────────────────────────────────────
    return NextResponse.json({
      totalPatients,
      newPatients,
      returningPatients,
      activePatients,
      inactivePatients,

      todayTotal: todayAppointments.length,
      missedWeek: missedWeekCount,
      confirmedUpcoming: todayAppointments.filter(
        (a) => a.status === "CONFIRMED"
      ).length,

      todayAppointments,
      recentAppointments,
      weekCounts,

      allPatients: enrichedPatients,
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);

    return NextResponse.json(
      { error: "Failed to load dashboard data" },
      { status: 500 }
    );
  }
}