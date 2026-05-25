/**
 * src/app/api/cron/waitlist-expire/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Cron job — runs every 30 minutes (configure in vercel.json).
 *
 * 1. Finds all NOTIFIED waitlist entries whose expiresAt has passed.
 * 2. Marks them EXPIRED.
 * 3. Tries to notify the NEXT patient in the queue for the same slot.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyNextWaitlistPatient } from "@/app/api/waitlist/notify/route";

async function handler(req: NextRequest): Promise<NextResponse> {
  const auth   = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[Cron/waitlist-expire] Starting at", new Date().toISOString());

  try {
    const expired = await prisma.waitlist.findMany({
      where: {
        status:    "NOTIFIED",
        expiresAt: { lt: new Date() },
      },
      select: {
        id:            true,
        doctorId:      true,
        preferredDate: true,
      },
    });

    console.log(
      `[Cron/waitlist-expire] Found ${expired.length} expired NOTIFIED entries`
    );

    let expiredCount  = 0;
    let cascadedCount = 0;
    let errorCount    = 0;

    for (const entry of expired) {
      try {
        await prisma.waitlist.update({
          where: { id: entry.id },
          data:  { status: "EXPIRED" },
        });
        expiredCount++;

        const dateStr = entry.preferredDate.toLocaleDateString("en-CA", {
          timeZone: "Asia/Kolkata",
        });

        const result = await notifyNextWaitlistPatient(entry.doctorId, dateStr);

        if (result.notified) {
          cascadedCount++;
          console.log(
            `[Cron/waitlist-expire] Cascade notified: ${result.patientName} for ${dateStr}`
          );
        }
      } catch (err) {
        console.error(
          `[Cron/waitlist-expire] Error processing entry ${entry.id}:`,
          err
        );
        errorCount++;
      }
    }

    return NextResponse.json({
      ok:        true,
      timestamp: new Date().toISOString(),
      expired:   expiredCount,
      cascaded:  cascadedCount,
      errors:    errorCount,
    });
  } catch (err) {
    console.error("[Cron/waitlist-expire] Fatal error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export const GET  = handler;
export const POST = handler; // allows manual admin trigger