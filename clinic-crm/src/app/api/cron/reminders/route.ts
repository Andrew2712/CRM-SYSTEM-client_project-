/**
 * src/app/api/cron/reminders/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Vercel Cron Job — runs every hour (configured in vercel.json)
 * Processes CONFIRMED appointments and sends:
 *   • 24-hour reminder (WhatsApp → Patient)
 *   • 2-hour reminder  (WhatsApp → Patient)
 *
 * Security: Protected by Authorization: Bearer CRON_SECRET header.
 *           Vercel automatically sends this when invoking cron routes.
 *
 * Timing: Vercel cron is NOT exact — may fire a few minutes early/late.
 *   ✅ Uses RANGE windows, never strict equality.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hoursUntil } from "@/lib/timezone";
import { send24hReminder, send2hReminder } from "@/lib/notificationWorkflow";

export async function GET(req: NextRequest) {
  // ─── Security: Verify CRON_SECRET ───────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[Cron] Reminder job started at", new Date().toISOString());

  // ─── Fetch all CONFIRMED upcoming appointments ───────────────────────────
  const appointments = await prisma.appointment.findMany({
    where: {
      status: "CONFIRMED",
      startTime: {
        // Only fetch appointments in the future (within the next 26 hours)
        // to avoid processing already-passed appointments
        gte: new Date(),
        lte: new Date(Date.now() + 26 * 60 * 60 * 1000),
      },
    },
    include: {
      patient: true,
      doctor: true,
    },
  });

  console.log(`[Cron] Processing ${appointments.length} CONFIRMED appointments`);

  const results = {
    processed: 0,
    reminder24h: 0,
    reminder2h: 0,
    errors: 0,
  };

  for (const appt of appointments) {
    const diffHours = hoursUntil(appt.startTime);

    try {
      // ── STEP 2: 24-hour reminder ─────────────────────────────────────────
      // Window: more than 23h but at most 24h away (safe range for hourly cron)
      if (diffHours <= 24 && diffHours > 23) {
        console.log(`[Cron] Sending 24h reminder for appointment ${appt.id}`);
        await send24hReminder(appt.id);
        results.reminder24h++;
      }

      // ── STEP 3: 2-hour reminder ──────────────────────────────────────────
      // Window: more than 1h but at most 2h away (safe range for hourly cron)
      else if (diffHours <= 2 && diffHours > 1) {
        console.log(`[Cron] Sending 2h reminder for appointment ${appt.id}`);
        await send2hReminder(appt.id);
        results.reminder2h++;
      }

      results.processed++;
    } catch (err) {
      console.error(`[Cron] Error processing appointment ${appt.id}:`, err);
      results.errors++;
    }
  }

  console.log("[Cron] Reminder job completed:", results);

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    ...results,
  });
}