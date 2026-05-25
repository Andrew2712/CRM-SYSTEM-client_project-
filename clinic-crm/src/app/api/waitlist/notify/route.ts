/**
 * src/app/api/waitlist/notify/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/waitlist/notify
 *
 * Called automatically when a slot becomes available (appointment cancelled /
 * rescheduled / reassigned). Also callable manually by ADMIN.
 *
 * Body: { doctorId: string; date: string }   — date = "YYYY-MM-DD" (IST)
 *
 * CRITICAL: Uses a Prisma transaction to prevent race conditions.
 * Only the FIRST matching entry is notified — no double-booking.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { rateLimitWrite, rateLimitResponse } from "@/lib/rateLimit";
import { sendWaitlistSlotNotification } from "@/lib/waitlistNotifications";

export async function POST(req: NextRequest) {
  const rl = await rateLimitWrite(req);
  if (!rl.success) return rateLimitResponse(rl);

  // Allow both internal calls (CRON_SECRET) and admin calls (session)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isInternalCall = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isInternalCall) {
    let session;
    try { session = await requireAuth(); } catch (e) { return e as NextResponse; }
    if (session.user.role !== "ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { doctorId: string; date: string; time?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.doctorId || !body.date)
    return NextResponse.json({ error: "doctorId and date are required" }, { status: 400 });

  try {
    const result = await notifyNextWaitlistPatient(body.doctorId, body.date);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[POST /api/waitlist/notify]", err);
    return NextResponse.json({ error: "Failed to process waitlist" }, { status: 500 });
  }
}

// ─── Core Logic ───────────────────────────────────────────────────────────────

export async function notifyNextWaitlistPatient(
  doctorId: string,
  dateStr: string   // "YYYY-MM-DD" IST
): Promise<{ notified: boolean; waitlistId?: string; patientName?: string; reason?: string }> {
  // Parse date — compare against preferredDate
  // We stored preferredDate as a UTC timestamp of the start-of-day in IST
  const [year, month, day] = dateStr.split("-").map(Number);

  // IST start-of-day = UTC (date - 5h30m). Build a range for that IST day in UTC.
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const dayStartUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - IST_OFFSET_MS);
  const dayEndUTC   = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - IST_OFFSET_MS);

  // ── Transaction: find + lock the top-priority PENDING entry ───────────────
  const result = await prisma.$transaction(async (tx) => {
    // Find the highest-priority PENDING entry for this doctor on this date
    const entry = await tx.waitlist.findFirst({
      where: {
        doctorId,
        status: "PENDING",
        preferredDate: { gte: dayStartUTC, lte: dayEndUTC },
      },
      orderBy: [
        { priority: "desc" },
        { createdAt: "asc" },
      ],
      include: {
        patient: {
          select: { id: true, name: true, phone: true, email: true },
        },
        doctor: { select: { id: true, name: true } },
      },
    });

    if (!entry) return { notified: false, reason: "No pending waitlist entries for this slot" };

    // Check it hasn't expired
    if (entry.expiresAt && entry.expiresAt < new Date())
      return { notified: false, reason: "Waitlist entry has expired" };

    // Mark as NOTIFIED (within the same transaction — prevents race)
    await tx.waitlist.update({
      where: { id: entry.id },
      data:  {
        status:     "NOTIFIED",
        notifiedAt: new Date(),
        // Give patient 2 hours to respond before we move to next
        expiresAt:  new Date(Date.now() + 2 * 60 * 60 * 1000),
      },
    });

    return {
      notified:    true,
      waitlistId:  entry.id,
      patientName: entry.patient.name,
      entry,
    };
  });

  // ── Send notification outside the transaction (non-blocking) ──────────────
  if (result.notified && result.entry) {
    sendWaitlistSlotNotification(result.entry, dateStr).catch(console.error);
  }

  const { entry: _entry, ...safeResult } = result as { entry?: unknown; notified: boolean; waitlistId?: string; patientName?: string; reason?: string };
  return safeResult;
}
