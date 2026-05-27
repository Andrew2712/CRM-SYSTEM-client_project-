/**
 * src/app/api/cron/reminders/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Cron endpoint — triggered hourly by GitHub Actions (free, reliable).
 *
 * Why GitHub Actions instead of Vercel Cron?
 *   Vercel Hobby plan limits cron to daily. GitHub Actions runs every hour
 *   for free, which is required to catch both the 24h and 2h reminder windows.
 *
 * Duplicate prevention:
 *   Uses reminder24hSent / reminder2hSent flags on the Appointment model.
 *   Each reminder is only sent once — even if the cron fires multiple times
 *   in the same window due to drift or retries.
 *
 * Security:
 *   Authorization: Bearer <CRON_SECRET> header — set identically in
 *   Vercel env vars and GitHub Actions secrets.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hoursUntil } from "@/lib/timezone";
import { send24hReminder, send2hReminder } from "@/lib/notificationWorkflow";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.warn("[Cron] Unauthorized request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  console.log("[Cron] Reminder job started at", startedAt);

  // ── Fetch CONFIRMED appointments in the next 26h ─────────────────────────
  // Fetch a slightly wider window (26h) than our largest reminder (24h) to
  // account for GitHub Actions firing a few minutes early.
  const appointments = await prisma.appointment.findMany({
    where: {
      status:    "CONFIRMED",
      startTime: {
        gte: new Date(),
        lte: new Date(Date.now() + 26 * 60 * 60 * 1000),
      },
    },
    include: {
      patient: true,
      doctor:  true,
    },
  });

  console.log(`[Cron] Found ${appointments.length} upcoming CONFIRMED appointments`);

  const results = {
    processed:   0,
    reminder24h: 0,
    reminder2h:  0,
    skipped:     0,   // already sent
    errors:      0,
  };

  for (const appt of appointments) {
    const diffHours = hoursUntil(appt.startTime);

    try {
      // ── 24h window ───────────────────────────────────────────────────────
      if (diffHours <= 24 && diffHours > 23) {
        if (appt.reminder24hSent) {
          console.log(`[Cron] 24h reminder already sent for ${appt.id} — skipping`);
          results.skipped++;
        } else {
          console.log(`[Cron] Sending 24h reminder for ${appt.id} (${diffHours.toFixed(2)}h away)`);
          await send24hReminder(appt.id);

          // Mark as sent — prevents duplicates if cron fires again in this window
          await prisma.appointment.update({
            where: { id: appt.id },
            data:  { reminder24hSent: true },
          });

          results.reminder24h++;
        }
      }

      // ── 2h window ────────────────────────────────────────────────────────
      else if (diffHours <= 2 && diffHours > 1) {
        if (appt.reminder2hSent) {
          console.log(`[Cron] 2h reminder already sent for ${appt.id} — skipping`);
          results.skipped++;
        } else {
          console.log(`[Cron] Sending 2h reminder for ${appt.id} (${diffHours.toFixed(2)}h away)`);
          await send2hReminder(appt.id);

          await prisma.appointment.update({
            where: { id: appt.id },
            data:  { reminder2hSent: true },
          });

          results.reminder2h++;
        }
      }

      results.processed++;
    } catch (err) {
      console.error(`[Cron] Error processing appointment ${appt.id}:`, err);
      results.errors++;
    }
  }

  console.log("[Cron] Job completed:", results);

  return NextResponse.json({
    ok:        true,
    startedAt,
    finishedAt: new Date().toISOString(),
    ...results,
  });
}