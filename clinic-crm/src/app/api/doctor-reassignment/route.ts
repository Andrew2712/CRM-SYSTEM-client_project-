/**
 * src/app/api/doctor-reassignment/[id]/route.ts
 * PATCH /api/doctor-reassignment/:id → accept / reject (DOCTOR or ADMIN)
 *
 * ─── WHAT CHANGED ───────────────────────────────────────────────────────────
 *
 * BEFORE: When a doctor ACCEPTED a reassignment request the code did a simple
 *   prisma.appointment.update({ data: { doctorId: toDoctorId } })
 *   with NO check that the receiving doctor is free at that time.
 *
 * Scenario that was possible:
 *   Appointment A (10:00–11:00) is assigned to Dr. X, who already has
 *   Appointment B (10:00–11:00). Accepting the reassignment would silently
 *   stack two patients on Dr. X at the same hour.
 *
 * AFTER: The acceptance path runs inside a Serializable transaction that first
 *   calls findOverlappingAppointment() for the receiving doctor, excluding the
 *   appointment being moved (it currently belongs to another doctor, so it
 *   does not conflict with itself in the target doctor's calendar).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { createInAppNotification, notifyAdminAndReceptionist } from "@/lib/inAppNotifications";
import { sendReassignmentNotifications } from "@/lib/notificationWorkflow";
import { findOverlappingAppointment } from "@/lib/bookingConflict";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try { session = await requireAuth(); } catch (e) { return e as NextResponse; }

  const { id } = await params;

  let body: { status: "ACCEPTED" | "REJECTED" };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!["ACCEPTED", "REJECTED"].includes(body.status)) {
    return NextResponse.json({ error: "status must be ACCEPTED or REJECTED" }, { status: 400 });
  }

  try {
    const existing = await prisma.doctorReassignmentRequest.findUnique({
      where: { id },
      include: {
        appointment: { include: { patient: true } },
        fromDoctor:  { select: { id: true, name: true } },
        toDoctor:    { select: { id: true, name: true } },
      },
    });

    if (!existing)
      return NextResponse.json({ error: "Request not found" }, { status: 404 });

    if (
      session.user.role === "DOCTOR" &&
      existing.toDoctorId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── REJECTED path — no slot change, no conflict possible ───────────────
    if (body.status === "REJECTED") {
      const updated = await prisma.doctorReassignmentRequest.update({
        where: { id },
        data:  { status: "REJECTED" },
      });

      notifyAdminAndReceptionist(
        "REASSIGNMENT_REQUEST",
        "Reassignment Rejected",
        `Dr. ${existing.toDoctor.name} rejected the reassignment request`,
        id
      ).catch(console.error);

      return NextResponse.json(updated);
    }

    // ── ACCEPTED path — must check that receiving doctor is free ───────────
    const appt = existing.appointment;

    let updated;
    try {
      updated = await prisma.$transaction(
        async (tx) => {
          // The appointment currently belongs to fromDoctor so it will NOT
          // appear in toDoctorId's appointments — no need to exclude it.
          const conflict = await findOverlappingAppointment(tx, {
            doctorId:     existing.toDoctorId,
            newStartTime: appt.startTime,
            newEndTime:   appt.endTime,
          });

          if (conflict) {
            throw Object.assign(
              new Error("SLOT_CONFLICT"),
              { code: "SLOT_CONFLICT" }
            );
          }

          await tx.appointment.update({
            where: { id: existing.appointmentId },
            data:  { doctorId: existing.toDoctorId },
          });

          return tx.doctorReassignmentRequest.update({
            where: { id },
            data:  { status: "ACCEPTED" },
          });
        },
        { isolationLevel: "Serializable", timeout: 8000 }
      );
    } catch (err: unknown) {
      const e = err as { code?: string };

      if (e?.code === "SLOT_CONFLICT") {
        return NextResponse.json(
          {
            success: false,
            error:
              `Dr. ${existing.toDoctor.name} already has a booking at that time. ` +
              "The reassignment cannot be accepted.",
          },
          { status: 409 }
        );
      }

      throw err; // re-throw for the outer catch
    }

    // ── Post-commit notifications ──────────────────────────────────────────
    sendReassignmentNotifications(existing.appointmentId, existing.toDoctorId).catch(console.error);

    notifyAdminAndReceptionist(
      "DOCTOR_REASSIGNED",
      "Doctor Reassignment Accepted",
      `Dr. ${existing.toDoctor.name} accepted the reassignment for ${existing.appointment.patient.name}`,
      existing.appointmentId
    ).catch(console.error);

    createInAppNotification(
      existing.fromDoctorId,
      "DOCTOR_REASSIGNED",
      "Reassignment Accepted",
      `Dr. ${existing.toDoctor.name} will cover ${existing.appointment.patient.name}'s appointment`,
      existing.appointmentId
    ).catch(console.error);

    return NextResponse.json(updated);

  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2025")
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    console.error("[PATCH /api/doctor-reassignment/[id]] error:", err);
    return NextResponse.json({ error: "Failed to update reassignment" }, { status: 500 });
  }
}
