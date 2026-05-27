/**
 * src/app/api/health/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Health-check endpoint for uptime monitoring (UptimeRobot, Vercel cron, etc.)
 *
 * Returns:
 *  200 { status: "ok", db: "ok",  ts: "..." }  — healthy
 *  503 { status: "degraded", db: "error", ... } — DB unreachable
 *
 * This route is intentionally PUBLIC (no auth) so uptime monitors work.
 * It reveals no sensitive data — only a DB connectivity flag.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic"; // never cache health checks

export async function GET() {
  const ts = new Date().toISOString();

  try {
    // Cheap query — just confirms DB is reachable
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      { status: "ok", db: "ok", ts },
      { status: 200 }
    );
  } catch (err) {
    console.error("[Health] DB check failed:", err);
    return NextResponse.json(
      { status: "degraded", db: "error", ts },
      { status: 503 }
    );
  }
}
