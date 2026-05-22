/**
 * src/app/api/expenses/analytics/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/expenses/analytics
 *
 * Returns aggregated data for:
 *   - overview  (monthly, yearly, weekly, highest category)
 *   - monthlyTrend
 *   - categoryDistribution
 *   - weeklyExpenses
 *
 * Access: ADMIN only
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    return err as NextResponse;
  }

  // Analytics is ADMIN-only
  try {
    requireRole(session, ["ADMIN"]);
  } catch (err) {
    return err as NextResponse;
  }

  try {
    const now        = new Date();
    const year       = parseInt(req.nextUrl.searchParams.get("year") ?? String(now.getFullYear()), 10);

    // ── Date bounds ──────────────────────────────────────────────────────────
    const yearStart  = new Date(year, 0, 1);
    const yearEnd    = new Date(year, 11, 31, 23, 59, 59, 999);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const weekStart  = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd    = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // ── Parallel queries ─────────────────────────────────────────────────────

    const baseWhere = { isDeleted: false };

    const [allForYear, thisMonth, thisWeek] = await Promise.all([
      prisma.expense.findMany({
        where: { ...baseWhere, expenseDate: { gte: yearStart, lte: yearEnd } },
        select: { amount: true, category: true, expenseDate: true },
      }),
      prisma.expense.aggregate({
        where: { ...baseWhere, expenseDate: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { ...baseWhere, expenseDate: { gte: weekStart, lte: weekEnd } },
        _sum: { amount: true },
      }),
    ]);

    // ── Overview ─────────────────────────────────────────────────────────────
    const totalYearly  = allForYear.reduce((s, e) => s + e.amount, 0);
    const totalMonthly = thisMonth._sum.amount ?? 0;
    const totalWeekly  = thisWeek._sum.amount ?? 0;

    // Highest category this month
    const catMonthly: Record<string, number> = {};
    allForYear
      .filter(e => {
        const d = new Date(e.expenseDate);
        return d >= monthStart && d <= monthEnd;
      })
      .forEach(e => {
        catMonthly[e.category] = (catMonthly[e.category] ?? 0) + e.amount;
      });
    const highestCategory = Object.entries(catMonthly).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/A";

    // ── Monthly Trend (12 months of selected year) ───────────────────────────
    const monthlyMap: Record<string, number> = {};
    for (let m = 0; m < 12; m++) {
      const key = `${year}-${String(m + 1).padStart(2, "0")}`;
      monthlyMap[key] = 0;
    }
    allForYear.forEach(e => {
      const d   = new Date(e.expenseDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (key in monthlyMap) monthlyMap[key] += e.amount;
    });

    const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyTrend = Object.entries(monthlyMap).map(([key, total]) => {
      const month = parseInt(key.split("-")[1], 10) - 1;
      return { month: MONTH_LABELS[month], total: Math.round(total * 100) / 100 };
    });

    // ── Category Distribution ────────────────────────────────────────────────
    const catYearly: Record<string, number> = {};
    allForYear.forEach(e => {
      catYearly[e.category] = (catYearly[e.category] ?? 0) + e.amount;
    });
    const categoryDistribution = Object.entries(catYearly)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);

    // ── Weekly Expenses (last 8 weeks) ───────────────────────────────────────
    const weeks: { label: string; start: Date; end: Date }[] = [];
    for (let i = 7; i >= 0; i--) {
      const wStart = new Date(weekStart);
      wStart.setDate(weekStart.getDate() - i * 7);
      const wEnd = new Date(wStart);
      wEnd.setDate(wStart.getDate() + 6);
      wEnd.setHours(23, 59, 59, 999);
      weeks.push({
        label: `W${8 - i}`,
        start: new Date(wStart),
        end:   new Date(wEnd),
      });
    }

    const weeklyExpenses = await Promise.all(
      weeks.map(async ({ label, start, end }) => {
        const agg = await prisma.expense.aggregate({
          where: { ...baseWhere, expenseDate: { gte: start, lte: end } },
          _sum: { amount: true },
        });
        return { week: label, total: Math.round((agg._sum.amount ?? 0) * 100) / 100 };
      })
    );

    return NextResponse.json({
      overview: {
        totalMonthly: Math.round(totalMonthly * 100) / 100,
        totalYearly:  Math.round(totalYearly * 100) / 100,
        totalWeekly:  Math.round(totalWeekly * 100) / 100,
        highestCategory,
      },
      monthlyTrend,
      categoryDistribution,
      weeklyExpenses,
    });
  } catch (error) {
    console.error("GET /api/expenses/analytics error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
