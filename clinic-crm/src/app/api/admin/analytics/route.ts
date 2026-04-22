// src/app/api/admin/analytics/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [total, newPatients, returning, missed, attended, confirmed, sessionTypes] = await Promise.all([
    prisma.appointment.count(),
    prisma.patient.count({ where: { status: "NEW" } }),
    prisma.patient.count({ where: { status: "RETURNING" } }),
    prisma.appointment.count({ where: { status: "MISSED" } }),
    prisma.appointment.count({ where: { status: "ATTENDED" } }),
    prisma.appointment.count({ where: { status: "CONFIRMED" } }),
    prisma.appointment.groupBy({ by: ["sessionType"], _count: { sessionType: true } }),
  ]);

  const totalPatients = newPatients + returning;

  // ── Monthly trend (last 6 months) ──────────────────────────────────────────
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const [allAppointments, allPatients] = await Promise.all([
    prisma.appointment.findMany({
      where: { startTime: { gte: sixMonthsAgo } },
      select: { startTime: true, status: true },
    }),
    prisma.patient.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true, status: true },
    }),
  ]);

  // Build month buckets
  const monthMap: Record<string, { total: number; newPatients: number; returning: number }> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    monthMap[key] = { total: 0, newPatients: 0, returning: 0 };
  }

  allAppointments.forEach(a => {
    const key = new Date(a.startTime).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    if (monthMap[key]) monthMap[key].total++;
  });
  allPatients.forEach(p => {
    const key = new Date(p.createdAt).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    if (monthMap[key]) {
      if (p.status === "NEW") monthMap[key].newPatients++;
      else monthMap[key].returning++;
    }
  });

  const monthlyTrend = Object.entries(monthMap).map(([month, v]) => ({ month, ...v }));

  // ── Gender distribution with patient lists ──────────────────────────────────
  const genderGroups = await prisma.patient.groupBy({
    by: ["gender"],
    _count: { gender: true },
  });

  const genderDistribution = await Promise.all(
    genderGroups.map(async g => {
      const patients = await prisma.patient.findMany({
        where: { gender: g.gender },
        select: { id: true, name: true, patientCode: true, status: true, age: true },
        take: 50,
      });
      return {
        gender: g.gender ?? "OTHER",
        count: g._count.gender,
        patients,
      };
    })
  );

  // ── Phase distribution ─────────────────────────────────────────────────────
  const phaseGroups = await prisma.patient.groupBy({
    by: ["phase"],
    _count: { phase: true },
    where: { phase: { not: null } },
  });

  const phaseDistribution = await Promise.all(
    phaseGroups.map(async p => {
      // Average sessions attended per patient in this phase
      const patientsInPhase = await prisma.patient.findMany({
        where: { phase: p.phase },
        include: { _count: { select: { appointments: true } } },
      });
      const avgSessions = patientsInPhase.length > 0
        ? Math.round(patientsInPhase.reduce((sum, pt) => sum + pt._count.appointments, 0) / patientsInPhase.length)
        : 0;

      return {
        phase: p.phase ?? "UNASSIGNED",
        count: p._count.phase,
        avgSessions,
      };
    })
  );

  return NextResponse.json({
    total, newPatients, returning, missed, attended, confirmed,
    totalPatients, sessionTypes,
    monthlyTrend, genderDistribution, phaseDistribution,
  });
}