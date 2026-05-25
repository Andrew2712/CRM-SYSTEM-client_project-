/**
 * src/app/api/appointments/[id]/route.ts
 * PATCH /api/appointments/:id — update status / reschedule
 *
 * ─── WHAT CHANGED ───────────────────────────────────────────────────────────
 *
 * RESCHEDULE PATH (startTime / endTime supplied):
 *   BEFORE: Direct prisma.appointment.update() with NO conflict check.
 *           Two receptionists could reschedule different appointments into the
 *           same slot simultaneously — both would succeed.
 *
 *   AFTER:  Full overlap check + update wrapped in a Serializable transaction.
 *           The appointment being rescheduled is EXCLUDED from its own overlap
 *           check (via excludeAppointmentId) so moving a confirmed booking to
 *           a different time doesn't falsely conflict with itself.
 *
 * STATUS UPDATE PATH: unchanged — no slot is created/moved, no race possible.
 *
 * ─────────────────────────────────────────────────────────────────────────────
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

const VALID_STATUSES = ["ATTENDED", "MISSED", "CONFIRMED", "CANCELLED", "RESCHEDULED"] as const;
type UpdatableStatus = (typeof VALID_STATUSES)[number];

const MAX_RETRIES = 3;

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
            // Fetch the appointment first so we have doctorId and can snapshot
            // the "before" state for the audit log.
            const existing = await tx.appointment.findUnique({
              where: { id },
              select: { id: true, doctorId: true, startTime: true, status: true },
            });

            if (!existing) {
              throw Object.assign(new Error("NOT_FOUND"), { code: "NOT_FOUND" });
            }

            // Overlap check — exclude the appointment being rescheduled from
            // its own overlap test (it currently holds its old slot; we are
            // moving it, not conflicting with it).
            const conflict = await findOverlappingAppointment(tx, {
              doctorId:             existing.doctorId,
              newStartTime:         newStart,
              newEndTime:           newEnd,
              excludeAppointmentId: id,
            });

            if (conflict) {
              throw Object.assign(new Error("SLOT_CONFLICT"), { code: "SLOT_CONFLICT" });
            }

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

        // ── Post-commit side effects ──────────────────────────────────────
        const { updated, before } = appointment;
        const newDateTimeIST = toIST(newStart);

        createInAppNotification(
          updated.doctorId,
          "APPOINTMENT_RESCHEDULED",
          "Appointment Rescheduled",
          `${updated.patient.name}'s appointment has been rescheduled to ${newDateTimeIST}`,
          id
        ).catch(console.error);

        notifyAdminAndReceptionist(
          "APPOINTMENT_RESCHEDULED",
          "Appointment Rescheduled",
          `${updated.patient.name} with Dr. ${updated.doctor.name} → ${newDateTimeIST}`,
          id
        ).catch(console.error);

        sendRescheduleNotifications(id, newDateTimeIST).catch(console.error);

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

        // Prisma record-not-found on the update itself
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
  // STATUS UPDATE PATH  (no slot change — no race condition possible)
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
      where: { id },
      select: { status: true, notes: true },
    });

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (notes  !== undefined) updateData.notes  = notes;

    const appointment = await prisma.appointment.update({
      where: { id },
      data: updateData,
      include: { patient: true, doctor: { select: { id: true, name: true } } },
    });

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

    if (status === "MISSED") {
      sendMissedSessionNotifications(id).catch(console.error);
      notifyAdminAndReceptionist(
        "APPOINTMENT_MISSED",
        "Appointment Missed",
        `${appointment.patient.name} missed session with Dr. ${appointment.doctor.name}`,
        id
      ).catch(console.error);
    }

    if (status === "CANCELLED") {
      await prisma.notification
        .updateMany({ where: { appointmentId: id, status: "PENDING" }, data: { status: "FAILED" } })
        .catch(() => undefined);
      sendCancellationNotifications(id).catch(console.error);
      createInAppNotification(
        appointment.doctorId,
        "APPOINTMENT_CANCELLED",
        "Appointment Cancelled",
        `${appointment.patient.name}'s appointment has been cancelled`,
        id
      ).catch(console.error);
      notifyAdminAndReceptionist(
        "APPOINTMENT_CANCELLED",
        "Appointment Cancelled",
        `${appointment.patient.name} with Dr. ${appointment.doctor.name} — cancelled`,
        id
      ).catch(console.error);
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
