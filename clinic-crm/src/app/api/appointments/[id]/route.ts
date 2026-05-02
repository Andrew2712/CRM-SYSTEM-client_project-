/**
 * src/app/api/appointments/[id]/route.ts  (REPLACE existing file)
 * ─────────────────────────────────────────────────────────────────────────────
 * PATCH /api/appointments/:id
 * Extends existing logic with: cancel, reschedule, notes
 *
 * Roles:
 *   ATTENDED / MISSED / status updates  → ADMIN, DOCTOR (own only)
 *   CANCELLED / RESCHEDULED             → ADMIN, RECEPTIONIST
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
import {
  createInAppNotification,
  notifyAdminAndReceptionist,
} from "@/lib/inAppNotifications";
import { toIST } from "@/lib/timezone";

const VALID_STATUSES = ["ATTENDED", "MISSED", "CONFIRMED", "CANCELLED", "RESCHEDULED"] as const;
type UpdatableStatus = (typeof VALID_STATUSES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// PATCH
// ─────────────────────────────────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    return err as NextResponse;
  }

  const { id } = await params;

  // Parse body
  let body: {
    status?: UpdatableStatus;
    notes?: string;
    startTime?: string;
    endTime?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { status, notes, startTime, endTime } = body;

  // ── Reschedule path (ADMIN / RECEPTIONIST only) ───────────────────────────
  if (startTime || endTime) {
    try {
      requireRole(session, ["ADMIN", "RECEPTIONIST"]);
    } catch (err) {
      return err as NextResponse;
    }

    if (!startTime || !endTime) {
      return NextResponse.json(
        { error: "Both startTime and endTime required for reschedule" },
        { status: 400 }
      );
    }

    try {
      const appointment = await prisma.appointment.update({
        where: { id },
        data: {
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          status: "RESCHEDULED",
          rescheduleCount: { increment: 1 },
          ...(notes !== undefined ? { notes } : {}),
        },
        include: {
          patient: true,
          doctor: { select: { id: true, name: true } },
        },
      });

      const newDateTimeIST = toIST(new Date(startTime));

      // In-app: notify the doctor
      createInAppNotification(
        appointment.doctorId,
        "APPOINTMENT_RESCHEDULED",
        "Appointment Rescheduled",
        `${appointment.patient.name}'s appointment has been rescheduled to ${newDateTimeIST}`,
        id
      ).catch(console.error);

      // In-app: notify admin/receptionist
      notifyAdminAndReceptionist(
        "APPOINTMENT_RESCHEDULED",
        "Appointment Rescheduled",
        `${appointment.patient.name} with Dr. ${appointment.doctor.name} → ${newDateTimeIST}`,
        id
      ).catch(console.error);

      // External notifications
      sendRescheduleNotifications(id, newDateTimeIST).catch(console.error);

      revalidatePath("/dashboard");
      revalidatePath("/dashboard/booking");
      revalidatePath("/dashboard/doctor");

      return NextResponse.json(appointment);
    } catch (error) {
      console.error("PATCH /appointments/:id reschedule error:", error);
      return NextResponse.json({ error: "Failed to reschedule appointment" }, { status: 500 });
    }
  }

  // ── Status update path ────────────────────────────────────────────────────

  // Role check: CANCELLED → ADMIN or RECEPTIONIST only; others → ADMIN or DOCTOR
  if (status === "CANCELLED") {
    try {
      requireRole(session, ["ADMIN", "RECEPTIONIST"]);
    } catch (err) {
      return err as NextResponse;
    }
  } else {
    try {
      requireRole(session, ["ADMIN", "DOCTOR"]);
    } catch (err) {
      return err as NextResponse;
    }
    // DOCTOR ownership check
    try {
      await assertCanAccessAppointment(id, session);
    } catch (err) {
      return err as NextResponse;
    }
  }

  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Allowed: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    const appointment = await prisma.appointment.update({
      where: { id },
      data: updateData,
      include: {
        patient: true,
        doctor: { select: { id: true, name: true } },
      },
    });

    // ATTENDED → create/update visit + mark patient RETURNING
    if (status === "ATTENDED") {
      await prisma.patientVisit.upsert({
        where: { appointmentId: id },
        update: { status, notes: notes ?? null },
        create: {
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          appointmentId: id,
          sessionType: appointment.sessionType,
          status,
          visitDate: appointment.startTime,
          notes: notes ?? null,
        },
      });
      await prisma.patient.update({
        where: { id: appointment.patientId },
        data: { status: "RETURNING" },
      });
    }

    // MISSED → fire missed-session notifications
    if (status === "MISSED") {
      sendMissedSessionNotifications(id).catch(console.error);
      notifyAdminAndReceptionist(
        "APPOINTMENT_MISSED",
        "Appointment Missed",
        `${appointment.patient.name} missed session with Dr. ${appointment.doctor.name}`,
        id
      ).catch(console.error);
    }

    // CANCELLED → fire cancellation notifications
    if (status === "CANCELLED") {
      sendCancellationNotifications(id).catch(console.error);

      // In-app: notify the doctor
      createInAppNotification(
        appointment.doctorId,
        "APPOINTMENT_CANCELLED",
        "Appointment Cancelled",
        `${appointment.patient.name}'s appointment has been cancelled`,
        id
      ).catch(console.error);
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/doctor");
    revalidatePath("/dashboard/booking");

    return NextResponse.json(appointment);
  } catch (error) {
    console.error("PATCH /appointments/:id error:", error);
    return NextResponse.json({ error: "Failed to update appointment" }, { status: 500 });
  }
}
