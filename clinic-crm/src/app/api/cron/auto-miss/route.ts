/**
 * src/app/api/cron/auto-miss/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Safety-net cron — runs daily at 02:30 UTC (configured in vercel.json).
 *
 * Any appointment whose endTime is older than STALE_HOURS ago AND is still
 * CONFIRMED / RESCHEDULED is auto-flipped to MISSED.
 *
 * Fix from original:
 *   sendMissedSessionNotifications(), createInAppNotification(), and
 *   notifyAdminAndReceptionist() were all fire-and-forget (.catch only).
 *   Vercel kills the cron function as soon as the GET handler returns its
 *   NextResponse — all three promises died silently.
 *
 *   Fix: Promise.allSettled() waits for all three without throwing on
 *   individual failures. Each failure is logged clearly.
 *
 * Security: Bearer CRON_SECRET header (Vercel sends this automatically
 *           for registered cron routes; manual triggers need it too).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMissedSessionNotifications } from "@/lib/notificationWorkflow";
import { notifyAdminAndReceptionist, createInAppNotification } from "@/lib/inAppNotifications";

// Allow up to 60s — cron processes many appointments and sends notifications for each.
export const maxDuration = 60;

const STALE_HOURS = 36;

async function runAutoMiss() {
  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000);

  const stale = await prisma.appointment.findMany({
    where: {
      endTime: { lt: cutoff },
      status:  { in: ["CONFIRMED", "RESCHEDULED"] },
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

      // FIXED: await all side-effects via allSettled — never fire-and-forget.
      // allSettled waits for all three regardless of individual failures.
      const sideEffects = await Promise.allSettled([
        sendMissedSessionNotifications(appt.id),
        createInAppNotification(
          appt.doctor.id,
          "APPOINTMENT_MISSED",
          "Auto-marked as missed",
          `${appt.patient.name}'s session was auto-marked MISSED (no outcome recorded within ${STALE_HOURS}h).`,
          appt.id,
        ),
        notifyAdminAndReceptionist(
          "APPOINTMENT_MISSED",
          "Auto-marked as missed",
          `${appt.patient.name} (Dr. ${appt.doctor.name}) — no outcome within ${STALE_HOURS}h, auto-marked MISSED.`,
          appt.id,
        ),
      ]);

      sideEffects.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error(
            `[auto-miss] Side-effect ${index} failed for appointment ${appt.id}:`,
            result.reason
          );
        }
      });

      results.missed++;
    } catch (err) {
      console.error(`[auto-miss] Failed to process appointment ${appt.id}:`, err);
      results.errors++;
    }
  }

  return results;
}

export async function GET(req: NextRequest) {
  const auth   = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[auto-miss] Cron started at", new Date().toISOString());

  const results = await runAutoMiss();

  console.log("[auto-miss] Cron completed:", results);

  return NextResponse.json({
    ok:        true,
    timestamp: new Date().toISOString(),
    ...results,
  });
}

// Allow manual admin trigger with CRON_SECRET header.
export const POST = GET;
