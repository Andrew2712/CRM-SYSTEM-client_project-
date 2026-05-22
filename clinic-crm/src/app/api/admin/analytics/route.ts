import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ─── Constants ────────────────────────────────────────────────────────────────

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a "wall clock" local IST date to the equivalent UTC Date.
 * e.g. 1 May 2026 00:00:00 IST → 30 Apr 2026 18:30:00 UTC
 */
function istToUtc(year: number, month: number, day: number, h = 0, m = 0, s = 0, ms = 0): Date {
  const localMs = Date.UTC(year, month, day, h, m, s, ms);
  return new Date(localMs - IST_OFFSET_MS);
}

/**
 * Parse "YYYY-MM" → { start, end } with IST-aware boundaries.
 * start = 1st of month 00:00:00 IST (as UTC)
 * end   = last day of month 23:59:59.999 IST (as UTC)
 */
function parseMonthRange(monthParam: string | null): {
  start: Date; end: Date; year: number; month: number;
} {
  const now   = new Date();
  // Convert "now" to IST to get the correct current year/month
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  let year     = istNow.getUTCFullYear();
  let month    = istNow.getUTCMonth(); // 0-indexed

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    year  = y;
    month = m - 1;
  }

  const start = istToUtc(year, month, 1, 0, 0, 0, 0);
  // Last day of month: day 0 of next month
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const end     = istToUtc(year, month, lastDay, 23, 59, 59, 999);

  return { start, end, year, month };
}

/** Safe integer percentage — never NaN/Infinity */
function safePct(num: number, den: number): number {
  if (!den) return 0;
  return Math.round((num / den) * 100);
}

/**
 * Given a UTC Date, return which "IST day-of-month" it falls on,
 * then derive which week-of-month bucket (W1…W5) it belongs to.
 * W1 = days 1–7, W2 = 8–14, W3 = 15–21, W4 = 22–28, W5 = 29–end
 */
function weekBucketFromUtc(utcDate: Date): string {
  // Shift to IST
  const istDate   = new Date(utcDate.getTime() + IST_OFFSET_MS);
  const dayOfMonth = istDate.getUTCDate(); // 1-based
  const weekNum    = Math.ceil(dayOfMonth / 7);
  return `W${weekNum}`;
}

/**
 * Build week label objects for a given IST year/month.
 * Returns W1…W5 (W5 only if the month has 29+ days).
 */
function buildWeekLabels(
  year: number,
  month: number,
): { key: string; label: string; start: Date; end: Date }[] {
  const lastDay    = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const monthShort = new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-IN", {
    month: "short", timeZone: "Asia/Kolkata",
  });

  const weeks: { key: string; label: string; start: Date; end: Date }[] = [];
  let day = 1;
  let w   = 1;

  while (day <= lastDay) {
    const wStart = day;
    const wEnd   = Math.min(day + 6, lastDay);
    weeks.push({
      key:   `W${w}`,
      label: `W${w} (${monthShort} ${wStart}–${wEnd})`,
      start: istToUtc(year, month, wStart, 0, 0, 0, 0),
      end:   istToUtc(year, month, wEnd,   23, 59, 59, 999),
    });
    day += 7;
    w++;
  }

  return weeks;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)                      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" },   { status: 403 });

  const monthParam                  = req.nextUrl.searchParams.get("month");
  const { start, end, year, month } = parseMonthRange(monthParam);

  // ── 1. Core counts for the selected month ─────────────────────────────────
  const [attended, missed, cancelled, rescheduled, confirmed] = await Promise.all([
    prisma.appointment.count({ where: { status: "ATTENDED",    startTime: { gte: start, lte: end } } }),
    prisma.appointment.count({ where: { status: "MISSED",      startTime: { gte: start, lte: end } } }),
    prisma.appointment.count({ where: { status: "CANCELLED",   startTime: { gte: start, lte: end } } }),
    prisma.appointment.count({ where: { status: "RESCHEDULED", startTime: { gte: start, lte: end } } }),
    prisma.appointment.count({ where: { status: "CONFIRMED",   startTime: { gte: start, lte: end } } }),
  ]);

  const booked    = attended + missed + cancelled + rescheduled + confirmed;
  const conducted = attended + confirmed;

  const attendanceRate = safePct(attended,  booked);
  const missRate       = safePct(missed,    booked);
  const cancelRate     = safePct(cancelled, booked);

  // ── 2. Patient counts (all-time active, not month-scoped) ─────────────────
  const [newPatients, returning] = await Promise.all([
    prisma.patient.count({ where: { status: "NEW",       isActive: true } }),
    prisma.patient.count({ where: { status: "RETURNING", isActive: true } }),
  ]);
  const totalPatients = newPatients + returning;

  // ── 3. Session types for the month ────────────────────────────────────────
  const sessionTypes = await prisma.appointment.groupBy({
    by:     ["sessionType"],
    _count: { sessionType: true },
    where:  { startTime: { gte: start, lte: end } },
  });

  // ── 4. Weekly trend within the selected month ─────────────────────────────
  const weekLabels = buildWeekLabels(year, month);

  // Fetch all appointments in the month (IST-corrected range)
  const monthAppointments = await prisma.appointment.findMany({
    where:  { startTime: { gte: start, lte: end } },
    select: { startTime: true, status: true },
  });

  type WeekBucket = {
    week: string; label: string;
    total: number; attended: number; cancelled: number; missed: number;
  };

  // Initialise all week buckets to zero
  const weekMap: Record<string, WeekBucket> = {};
  weekLabels.forEach(w => {
    weekMap[w.key] = {
      week: w.key, label: w.label,
      total: 0, attended: 0, cancelled: 0, missed: 0,
    };
  });

  // Bucket each appointment using IST day-of-month
  monthAppointments.forEach(a => {
    const key = weekBucketFromUtc(new Date(a.startTime));
    if (!weekMap[key]) return; // safety — shouldn't happen
    weekMap[key].total++;
    if (a.status === "ATTENDED")  weekMap[key].attended++;
    if (a.status === "CANCELLED") weekMap[key].cancelled++;
    if (a.status === "MISSED")    weekMap[key].missed++;
  });

  const weeklyTrend = weekLabels.map(w => weekMap[w.key]);

  // ── 5. Monthly trend (last 6 months) — kept for backward compat ───────────
  // Use IST-aware start: 1st of month 6 months ago
  const istNow         = new Date(Date.now() + IST_OFFSET_MS);
  const sixMonthsAgoY  = istNow.getUTCMonth() >= 5
    ? istNow.getUTCFullYear()
    : istNow.getUTCFullYear() - 1;
  const sixMonthsAgoM  = ((istNow.getUTCMonth() - 5) + 12) % 12;
  const sixMonthsAgo   = istToUtc(sixMonthsAgoY, sixMonthsAgoM, 1, 0, 0, 0, 0);

  const trendAppointments = await prisma.appointment.findMany({
    where:  { startTime: { gte: sixMonthsAgo } },
    select: { startTime: true, status: true },
  });

  type MonthBucket = {
    total: number; attended: number; cancelled: number; missed: number;
  };

  const monthMap2: Record<string, MonthBucket> = {};
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(Date.now() + IST_OFFSET_MS);
    dt.setUTCMonth(dt.getUTCMonth() - i);
    const key = new Date(dt.getTime())
      .toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "Asia/Kolkata" });
    monthMap2[key] = { total: 0, attended: 0, cancelled: 0, missed: 0 };
  }

  trendAppointments.forEach(a => {
    const key = new Date(a.startTime)
      .toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "Asia/Kolkata" });
    if (!monthMap2[key]) return;
    monthMap2[key].total++;
    if (a.status === "ATTENDED")  monthMap2[key].attended++;
    if (a.status === "CANCELLED") monthMap2[key].cancelled++;
    if (a.status === "MISSED")    monthMap2[key].missed++;
  });

  const monthlyTrend = Object.entries(monthMap2).map(([m, v]) => ({ month: m, ...v }));

  // ── 6. Weekly heatmap (day-of-week within selected month, IST) ─────────────
  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weeklyMap: Record<string, number> = {};
  weekdayNames.forEach(d => { weeklyMap[d] = 0; });

  monthAppointments.forEach(a => {
    // Shift to IST before reading day-of-week
    const istDate = new Date(new Date(a.startTime).getTime() + IST_OFFSET_MS);
    const day     = weekdayNames[istDate.getUTCDay()];
    weeklyMap[day]++;
  });

  const weeklyHeatmap = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => ({
    day,
    count: weeklyMap[day] ?? 0,
  }));

  // ── 7. Doctor performance (month-scoped) ──────────────────────────────────
  const doctors = await prisma.user.findMany({
    where:  { role: "DOCTOR", isActive: true },
    select: { id: true, name: true },
  });

  const doctorPerformance = await Promise.all(
    doctors.map(async (doc: { id: string; name: string }) => {
      const [docAttended, docMissed, docCancelled] = await Promise.all([
        prisma.appointment.count({ where: { doctorId: doc.id, status: "ATTENDED",  startTime: { gte: start, lte: end } } }),
        prisma.appointment.count({ where: { doctorId: doc.id, status: "MISSED",    startTime: { gte: start, lte: end } } }),
        prisma.appointment.count({ where: { doctorId: doc.id, status: "CANCELLED", startTime: { gte: start, lte: end } } }),
      ]);
      const docTotal = docAttended + docMissed + docCancelled;
      return {
        id:               doc.id,
        name:             doc.name,
        total:            docTotal,
        attended:         docAttended,
        cancelled:        docCancelled,
        missed:           docMissed,
        attendanceRate:   safePct(docAttended,  docTotal),
        cancellationRate: safePct(docCancelled, docTotal),
      };
    })
  );

  // ── 8. Gender distribution ────────────────────────────────────────────────
  const genderGroups = await prisma.patient.groupBy({
    by:     ["gender"],
    _count: { gender: true },
    where:  { isActive: true },
  });

  const genderDistribution = await Promise.all(
    genderGroups.map(async g => {
      const patients = await prisma.patient.findMany({
        where:  { gender: g.gender, isActive: true },
        select: { id: true, name: true, patientCode: true, status: true, age: true },
        take:   50,
      });
      return { gender: g.gender ?? "OTHER", count: g._count.gender, patients };
    })
  );

  // ── 9. Phase distribution ─────────────────────────────────────────────────
  const phaseGroups = await prisma.patient.groupBy({
    by:     ["phase"],
    _count: { phase: true },
    where:  { phase: { not: null }, isActive: true },
  });

  const phaseDistribution = await Promise.all(
    phaseGroups.map(async p => {
      const patientsInPhase = await prisma.patient.findMany({
        where:   { phase: p.phase, isActive: true },
        include: {
          _count: { select: { appointments: { where: { status: { not: "CANCELLED" } } } } },
        },
      });
      const avgSessions =
        patientsInPhase.length > 0
          ? Math.round(
              patientsInPhase.reduce((s, pt) => s + pt._count.appointments, 0) /
                patientsInPhase.length
            )
          : 0;
      return { phase: p.phase ?? "UNASSIGNED", count: p._count.phase, avgSessions };
    })
  );

  // ── 10. Full appointments list for drilldown modal ────────────────────────
  const appointments = await prisma.appointment.findMany({
    where:   { startTime: { gte: start, lte: end } },
    select:  {
      id: true, startTime: true, endTime: true,
      status: true, sessionType: true, notes: true,
      patient: { select: { id: true, name: true, patientCode: true } },
      doctor:  { select: { id: true, name: true } },
    },
    orderBy: { startTime: "desc" },
    take:    500,
  });

  // ── 11. Auto-insights ─────────────────────────────────────────────────────
  const insights: string[] = [];
  if (attendanceRate >= 80)
    insights.push(`Great month — ${attendanceRate}% attendance rate, above the 80% target.`);
  if (missRate >= 20)
    insights.push(`No-show rate is ${missRate}% — consider sending appointment reminders.`);
  if (cancelRate >= 15)
    insights.push(`Cancellation rate at ${cancelRate}% — review cancellation reasons.`);
  const topDoc = [...doctorPerformance].sort((a, b) => b.attended - a.attended)[0];
  if (topDoc?.attended > 0)
    insights.push(`Top performer: ${topDoc.name} with ${topDoc.attended} attended sessions.`);

  // ── Response ──────────────────────────────────────────────────────────────
  return NextResponse.json({
    booked, attended, missed, cancelled, rescheduled, confirmed, conducted,
    attendanceRate, missRate, cancelRate,
    totalPatients, newPatients, returning,
    sessionTypes,
    weeklyTrend,
    monthlyTrend,
    weeklyHeatmap,
    doctorPerformance,
    genderDistribution,
    phaseDistribution,
    appointments,
    insights,
    selectedMonth: monthParam ?? `${year}-${String(month + 1).padStart(2, "0")}`,
  });
}