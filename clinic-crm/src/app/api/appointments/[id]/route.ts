/**
 * src/app/api/appointments/[id]/route.ts
 * PATCH /api/appointments/:id — update status / reschedule
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth, requireRole, assertCanAccessAppointment } from "@/lib/rbac";
import { sendMissedSessionNotifications, sendCancellationNotifications, sendRescheduleNotifications } from "@/lib/notificationWorkflow";
import { createInAppNotification, notifyAdminAndReceptionist } from "@/lib/inAppNotifications";
import { toIST } from "@/lib/timezone";
import { rateLimitWrite, rateLimitResponse } from "@/lib/rateLimit";
import { auditAppointment } from "@/lib/audit";

const VALID_STATUSES = ["ATTENDED", "MISSED", "CONFIRMED", "CANCELLED", "RESCHEDULED"] as const;
type UpdatableStatus = (typeof VALID_STATUSES)[number];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = await rateLimitWrite(req);
  if (!rl.success) return rateLimitResponse(rl);

  let session;
  try { session = await requireAuth(); } catch (err) { return err as NextResponse; }

  const { id } = await params;

  let body: { status?: UpdatableStatus; notes?: string; startTime?: string; endTime?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const { status, notes, startTime, endTime } = body;

  // ── Reschedule path ───────────────────────────────────────────────────────
  if (startTime || endTime) {
    try { requireRole(session, ["ADMIN", "RECEPTIONIST"]); }
    catch (err) { return err as NextResponse; }

    if (!startTime || !endTime)
      return NextResponse.json({ error: "Both startTime and endTime required for reschedule" }, { status: 400 });
    if (new Date(startTime) >= new Date(endTime))
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });

    try {
      const before = await prisma.appointment.findUnique({ where: { id }, select: { startTime: true, status: true } });

      const appointment = await prisma.appointment.update({
        where: { id },
        data: {
          startTime: new Date(startTime), endTime: new Date(endTime),
          status: "RESCHEDULED", rescheduleCount: { increment: 1 },
          ...(notes !== undefined ? { notes } : {}),
        },
        include: { patient: true, doctor: { select: { id: true, name: true } } },
      });

      const newDateTimeIST = toIST(new Date(startTime));
      createInAppNotification(appointment.doctorId, "APPOINTMENT_RESCHEDULED", "Appointment Rescheduled",
        `${appointment.patient.name}'s appointment has been rescheduled to ${newDateTimeIST}`, id).catch(console.error);
      notifyAdminAndReceptionist("APPOINTMENT_RESCHEDULED", "Appointment Rescheduled",
        `${appointment.patient.name} with Dr. ${appointment.doctor.name} → ${newDateTimeIST}`, id).catch(console.error);
      sendRescheduleNotifications(id, newDateTimeIST).catch(console.error);

      // ── Audit ──
      await auditAppointment(session, req, "UPDATE", id, {
        patientName: appointment.patient.name,
        status: "RESCHEDULED",
        old: { startTime: before?.startTime, status: before?.status },
        new: { startTime, endTime, status: "RESCHEDULED" },
      });

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
  if (status === "CANCELLED") {
    try { requireRole(session, ["ADMIN", "RECEPTIONIST"]); } catch (err) { return err as NextResponse; }
  } else {
    try { requireRole(session, ["ADMIN", "DOCTOR"]); } catch (err) { return err as NextResponse; }
    try { await assertCanAccessAppointment(id, session); } catch (err) { return err as NextResponse; }
  }

  if (status && !VALID_STATUSES.includes(status))
    return NextResponse.json({ error: `Invalid status. Allowed: ${VALID_STATUSES.join(", ")}` }, { status: 400 });

  try {
    const before = await prisma.appointment.findUnique({ where: { id }, select: { status: true, notes: true } });
    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (notes  !== undefined) updateData.notes  = notes;

    const appointment = await prisma.appointment.update({
      where: { id }, data: updateData,
      include: { patient: true, doctor: { select: { id: true, name: true } } },
    });

    if (status === "ATTENDED") {
      await prisma.patientVisit.upsert({
        where: { appointmentId: id },
        update: { status, notes: notes ?? null, visitDate: appointment.startTime },
        create: {
          patientId: appointment.patientId, doctorId: appointment.doctorId,
          appointmentId: id, sessionType: appointment.sessionType,
          status, visitDate: appointment.startTime, notes: notes ?? null,
        },
      });
      await prisma.patient.update({ where: { id: appointment.patientId }, data: { status: "RETURNING" } });
    }

    if (status === "MISSED") {
      sendMissedSessionNotifications(id).catch(console.error);
      notifyAdminAndReceptionist("APPOINTMENT_MISSED", "Appointment Missed",
        `${appointment.patient.name} missed session with Dr. ${appointment.doctor.name}`, id).catch(console.error);
    }

    if (status === "CANCELLED") {
      await prisma.notification.updateMany({ where: { appointmentId: id, status: "PENDING" }, data: { status: "FAILED" } }).catch(() => undefined);
      sendCancellationNotifications(id).catch(console.error);
      createInAppNotification(appointment.doctorId, "APPOINTMENT_CANCELLED", "Appointment Cancelled",
        `${appointment.patient.name}'s appointment has been cancelled`, id).catch(console.error);
      notifyAdminAndReceptionist("APPOINTMENT_CANCELLED", "Appointment Cancelled",
        `${appointment.patient.name} with Dr. ${appointment.doctor.name} — cancelled`, id).catch(console.error);
    }

    // ── Audit ──
    await auditAppointment(session, req, "UPDATE", id, {
      patientName: appointment.patient.name,
      status: status ?? "notes updated",
      old: { status: before?.status, notes: before?.notes },
      new: updateData,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/doctor");
    revalidatePath("/dashboard/booking");
    return NextResponse.json(appointment);
  } catch (error) {
    console.error("PATCH /appointments/:id error:", error);
    return NextResponse.json({ error: "Failed to update appointment" }, { status: 500 });
  }
}
