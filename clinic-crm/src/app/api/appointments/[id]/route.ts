/**
 * src/app/api/appointments/[id]/route.ts
 * PATCH /api/appointments/:id — update status / reschedule
 *
 * FIX: All 8 fire-and-forget notification calls replaced with awaited
 * Promise.allSettled(). When Next.js returns NextResponse, Vercel immediately
 * kills the serverless function — any un-awaited promise dies silently.
 * This is why reschedule / missed / cancel notifications worked locally
 * but never fired on Vercel.
 *
 * The settle() helper waits for every notification, logs individual failures,
 * and never throws — so a failed WhatsApp send never causes the status
 * update itself to return a 500.
 *
 * maxDuration = 30 allows up to 30s on Vercel Pro (default is 10s on Hobby).
 * Reschedule path: DB transaction (≤8s) + 3 notification sends.
 * Status path: DB write + up to 4 notification sends.
 *
 * Everything else (transaction, overlap check, RBAC, audit, retry) unchanged.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth, requireRole, assertCanAccessAppointment } from "@/lib/rbac";
import {
  sendMissedSessionNotifications,
  sendCancellationNotifications,
  sendRescheduleNotifications,
} from "@/lib/notificationWorkflow";
import { createInAppNotification, notifyAdminAndReceptionist } from "@/lib/inAppNotifications";
import { toIST } from "@/lib/timezone";
import { rateLimitWrite, rateLimitResponse } from "@/lib/rateLimit";
import { auditAppointment } from "@/lib/audit";
import { findOverlappingAppointment } from "@/lib/bookingConflict";

export const maxDuration = 30;

const VALID_STATUSES = ["ATTENDED", "MISSED", "CONFIRMED", "CANCELLED", "RESCHEDULED"] as const;
type UpdatableStatus = (typeof VALID_STATUSES)[number];

const MAX_RETRIES = 3;

// ─── Helper ───────────────────────────────────────────────────────────────────
// Awaits all tasks via allSettled — never throws, logs individual failures.
// This ensures Vercel keeps the function alive until every notification
// has been sent or failed, rather than killing them when NextResponse returns.
async function settle(label: string, tasks: Promise<unknown>[]): Promise<void> {
  const results = await Promise.allSettled(tasks);
  results.forEach((r, i) => {
    if (r.status === "rejected")
      console.error(`[${label}] notification task ${i} failed:`, r.reason);
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rl = await rateLimitWrite(req);
  if (!rl.success) return rateLimitResponse(rl);

  let session;
  try { session = await requireAuth(); } catch (err) { return err as NextResponse; }

  const { id } = await params;

  let body: { status?: UpdatableStatus; notes?: string; startTime?: string; endTime?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const { status, notes, startTime, endTime } = body;

  // ══════════════════════════════════════════════════════════════════════════
  // RESCHEDULE PATH
  // ══════════════════════════════════════════════════════════════════════════
  if (startTime || endTime) {
    try { requireRole(session, ["ADMIN", "RECEPTIONIST"]); }
    catch (err) { return err as NextResponse; }

    if (!startTime || !endTime)
      return NextResponse.json(
        { error: "Both startTime and endTime required for reschedule" },
        { status: 400 }
      );

    const newStart = new Date(startTime);
    const newEnd   = new Date(endTime);

    if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime()))
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });

    if (newStart >= newEnd)
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 }
      );

    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const appointment = await prisma.$transaction(
          async (tx) => {
            const existing = await tx.appointment.findUnique({
              where:  { id },
              select: { id: true, doctorId: true, startTime: true, status: true },
            });

            if (!existing)
              throw Object.assign(new Error("NOT_FOUND"), { code: "NOT_FOUND" });

            // Exclude this appointment from its own overlap check — moving it
            // doesn't conflict with the slot it currently holds.
            const conflict = await findOverlappingAppointment(tx, {
              doctorId:             existing.doctorId,
              newStartTime:         newStart,
              newEndTime:           newEnd,
              excludeAppointmentId: id,
            });

            if (conflict)
              throw Object.assign(new Error("SLOT_CONFLICT"), { code: "SLOT_CONFLICT" });

            const updated = await tx.appointment.update({
              where: { id },
              data: {
                startTime:       newStart,
                endTime:         newEnd,
                status:          "RESCHEDULED",
                rescheduleCount: { increment: 1 },
                ...(notes !== undefined ? { notes } : {}),
              },
              include: {
                patient: true,
                doctor:  { select: { id: true, name: true } },
              },
            });

            return { updated, before: existing };
          },
          { isolationLevel: "Serializable", timeout: 8000 }
        );

        // ── Post-commit notifications ─────────────────────────────────────
        // FIX: was 3× .catch(console.error) — killed by Vercel on return.
        // Now awaited via settle() so the function stays alive until done.
        const { updated, before } = appointment;
        const newDateTimeIST = toIST(newStart);

        await settle("Reschedule", [
          createInAppNotification(
            updated.doctorId,
            "APPOINTMENT_RESCHEDULED",
            "Appointment Rescheduled",
            `${updated.patient.name}'s appointment has been rescheduled to ${newDateTimeIST}`,
            id
          ),
          notifyAdminAndReceptionist(
            "APPOINTMENT_RESCHEDULED",
            "Appointment Rescheduled",
            `${updated.patient.name} with Dr. ${updated.doctor.name} → ${newDateTimeIST}`,
            id
          ),
          sendRescheduleNotifications(id, newDateTimeIST),
        ]);

        await auditAppointment(session, req, "UPDATE", id, {
          patientName: updated.patient.name,
          status:      "RESCHEDULED",
          old: { startTime: before.startTime, status: before.status },
          new: { startTime, endTime, status: "RESCHEDULED" },
        });

        revalidatePath("/dashboard");
        revalidatePath("/dashboard/booking");
        revalidatePath("/dashboard/doctor");
        return NextResponse.json(updated);

      } catch (err: unknown) {
        const e = err as { code?: string };

        if (e?.code === "NOT_FOUND")
          return NextResponse.json({ error: "Appointment not found" }, { status: 404 });

        if (e?.code === "SLOT_CONFLICT")
          return NextResponse.json(
            { success: false, error: "The target slot is already booked. Please choose a different time." },
            { status: 409 }
          );

        if (e?.code === "P2034") {
          lastError = err;
          await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
          continue;
        }

        if ((e as { code?: string })?.code === "P2025")
          return NextResponse.json({ error: "Appointment not found" }, { status: 404 });

        console.error("PATCH /appointments/:id reschedule error:", err);
        return NextResponse.json({ error: "Failed to reschedule appointment" }, { status: 500 });
      }
    }

    console.error("PATCH /appointments/:id reschedule: retries exhausted", lastError);
    return NextResponse.json(
      { error: "The system is busy. Please try again." },
      { status: 503 }
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STATUS UPDATE PATH
  // ══════════════════════════════════════════════════════════════════════════
  if (status === "CANCELLED") {
    try { requireRole(session, ["ADMIN", "RECEPTIONIST"]); } catch (err) { return err as NextResponse; }
  } else {
    try { requireRole(session, ["ADMIN", "DOCTOR"]); } catch (err) { return err as NextResponse; }
    try { await assertCanAccessAppointment(id, session); } catch (err) { return err as NextResponse; }
  }

  if (status && !VALID_STATUSES.includes(status))
    return NextResponse.json(
      { error: `Invalid status. Allowed: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );

  try {
    const before = await prisma.appointment.findUnique({
      where:  { id },
      select: { status: true, notes: true },
    });

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (notes  !== undefined) updateData.notes  = notes;

    const appointment = await prisma.appointment.update({
      where:   { id },
      data:    updateData,
      include: { patient: true, doctor: { select: { id: true, name: true } } },
    });

    // ── ATTENDED: log the visit + flip patient to RETURNING ────────────────
    if (status === "ATTENDED") {
      await prisma.patientVisit.upsert({
        where:  { appointmentId: id },
        update: { status, notes: notes ?? null, visitDate: appointment.startTime },
        create: {
          patientId:     appointment.patientId,
          doctorId:      appointment.doctorId,
          appointmentId: id,
          sessionType:   appointment.sessionType,
          status,
          visitDate:     appointment.startTime,
          notes:         notes ?? null,
        },
      });
      await prisma.patient.update({
        where: { id: appointment.patientId },
        data:  { status: "RETURNING" },
      });
    }

    // ── MISSED ─────────────────────────────────────────────────────────────
    // FIX: was 2× .catch(console.error) — killed by Vercel on return.
    if (status === "MISSED") {
      await settle("Missed", [
        sendMissedSessionNotifications(id),
        notifyAdminAndReceptionist(
          "APPOINTMENT_MISSED",
          "Appointment Missed",
          `${appointment.patient.name} missed session with Dr. ${appointment.doctor.name}`,
          id
        ),
      ]);
    }

    // ── CANCELLED ──────────────────────────────────────────────────────────
    // FIX: was 3× .catch(console.error) — killed by Vercel on return.
    if (status === "CANCELLED") {
      // Void pending reminders first — awaited directly, must complete before
      // notifications fire (no point sending a reminder for a cancelled appt).
      await prisma.notification
        .updateMany({
          where: { appointmentId: id, status: "PENDING" },
          data:  { status: "FAILED" },
        })
        .catch(() => undefined);

      await settle("Cancelled", [
        sendCancellationNotifications(id),
        createInAppNotification(
          appointment.doctorId,
          "APPOINTMENT_CANCELLED",
          "Appointment Cancelled",
          `${appointment.patient.name}'s appointment has been cancelled`,
          id
        ),
        notifyAdminAndReceptionist(
          "APPOINTMENT_CANCELLED",
          "Appointment Cancelled",
          `${appointment.patient.name} with Dr. ${appointment.doctor.name} — cancelled`,
          id
        ),
      ]);
    }

    await auditAppointment(session, req, "UPDATE", id, {
      patientName: appointment.patient.name,
      status:      status ?? "notes updated",
      old:  { status: before?.status, notes: before?.notes },
      new:  updateData,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/doctor");
    revalidatePath("/dashboard/booking");
    return NextResponse.json(appointment);

  } catch (error) {
    if ((error as { code?: string })?.code === "P2025")
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    console.error("PATCH /appointments/:id error:", error);
    return NextResponse.json({ error: "Failed to update appointment" }, { status: 500 });
  }
}