/**
 * src/app/api/appointments/missed/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/appointments/missed
 * Triggered when an appointment is marked MISSED (called from the PATCH handler
 * or from an admin action).
 *
 * Alternatively, the PATCH /api/appointments/[id] route calls this logic
 * directly via sendMissedSessionNotifications().
 *
 * This standalone endpoint exists for manual invocation (admin panel, retries).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { sendMissedSessionNotifications } from "@/lib/notificationWorkflow";

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    return err as NextResponse;
  }

  let body: { appointmentId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { appointmentId } = body;
  if (!appointmentId) {
    return NextResponse.json({ error: "appointmentId is required" }, { status: 400 });
  }

  // Verify the appointment exists and is MISSED
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!appt) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  if (appt.status !== "MISSED") {
    return NextResponse.json(
      { error: "Appointment is not MISSED" },
      { status: 400 }
    );
  }

  try {
    await sendMissedSessionNotifications(appointmentId);
    return NextResponse.json({ ok: true, message: "Missed session notifications sent" });
  } catch (err) {
    console.error("[MissedHandler] Error:", err);
    return NextResponse.json(
      { error: "Failed to send notifications" },
      { status: 500 }
    );
  }
}