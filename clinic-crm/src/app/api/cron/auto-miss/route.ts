/**
 * src/app/api/cron/auto-miss/route.ts  (NEW FILE)
 * ─────────────────────────────────────────────────────────────────────────────
 * Safety-net cron — runs daily.
 *
 * Any appointment whose `endTime` is older than `STALE_HOURS` ago AND is still
 * in CONFIRMED / RESCHEDULED status is auto-flipped to MISSED.
 *
 * This guarantees stuck "processing" sessions never sit in the system forever,
 * while still letting the doctor mark them ATTENDED/MISSED for the first 36 h.
 *
 * Configure in vercel.json:
 *   { "path": "/api/cron/auto-miss", "schedule": "30 2 * * *" }   // 02:30 UTC daily
 *
 * Security: Bearer CRON_SECRET (same as reminders cron).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMissedSessionNotifications } from "@/lib/notificationWorkflow";
import { notifyAdminAndReceptionist, createInAppNotification } from "@/lib/inAppNotifications";

const STALE_HOURS = 36;

async function runAutoMiss() {
  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000);

  const stale = await prisma.appointment.findMany({
    where: {
      endTime: { lt: cutoff },
      status: { in: ["CONFIRMED", "RESCHEDULED"] },
    },
    include: {
      patient: { select: { id: true, name: true } },
      doctor:  { select: { id: true, name: true } },
    },
  });

  const results = { scanned: stale.length, missed: 0, errors: 0 };

  for (const appt of stale) {
    try {
      await prisma.appointment.update({
        where: { id: appt.id },
        data:  { status: "MISSED" },
      });

      // Best-effort notifications
      sendMissedSessionNotifications(appt.id).catch(console.error);
      createInAppNotification(
        appt.doctor.id,
        "APPOINTMENT_MISSED",
        "Auto-marked as missed",
        `${appt.patient.name}'s session was auto-marked MISSED (no outcome recorded within ${STALE_HOURS}h).`,
        appt.id,
      ).catch(console.error);
      notifyAdminAndReceptionist(
        "APPOINTMENT_MISSED",
        "Auto-marked as missed",
        `${appt.patient.name} (Dr. ${appt.doctor.name}) — no outcome within ${STALE_HOURS}h, auto-marked MISSED.`,
        appt.id,
      ).catch(console.error);

      results.missed++;
    } catch (err) {
      console.error(`[auto-miss] Failed for ${appt.id}:`, err);
      results.errors++;
    }
  }

  return results;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const results = await runAutoMiss();
  return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), ...results });
}

// Allow manual admin trigger too (with CRON_SECRET header).
export const POST = GET;
