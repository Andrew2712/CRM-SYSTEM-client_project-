/**
 * src/app/api/doctor-reassignment/[id]/route.ts  (NEW FILE)
 * ─────────────────────────────────────────────────────────────────────────────
 * PATCH /api/doctor-reassignment/:id → accept / reject (DOCTOR only — the target doctor)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { createInAppNotification, notifyAdminAndReceptionist } from "@/lib/inAppNotifications";
import { sendReassignmentNotifications } from "@/lib/notificationWorkflow";

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
        fromDoctor: { select: { id: true, name: true } },
        toDoctor:   { select: { id: true, name: true } },
      },
    });

    if (!existing)
      return NextResponse.json({ error: "Request not found" }, { status: 404 });

    // Only the target doctor or ADMIN can respond
    if (
      session.user.role === "DOCTOR" &&
      existing.toDoctorId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await prisma.doctorReassignmentRequest.update({
      where: { id },
      data: { status: body.status },
    });

    if (body.status === "ACCEPTED") {
      // Update the appointment's doctorId
      await prisma.appointment.update({
        where: { id: existing.appointmentId },
        data: { doctorId: existing.toDoctorId },
      });

      // Fire external notifications (patient + old doctor + new doctor)
      sendReassignmentNotifications(existing.appointmentId, existing.toDoctorId).catch(console.error);

      // In-app: notify admin/receptionist
      notifyAdminAndReceptionist(
        "DOCTOR_REASSIGNED",
        "Doctor Reassignment Accepted",
        `Dr. ${existing.toDoctor.name} accepted the reassignment for ${existing.appointment.patient.name}`,
        existing.appointmentId
      ).catch(console.error);

      // In-app: notify original doctor
      createInAppNotification(
        existing.fromDoctorId,
        "DOCTOR_REASSIGNED",
        "Reassignment Accepted",
        `Dr. ${existing.toDoctor.name} will cover ${existing.appointment.patient.name}'s appointment`,
        existing.appointmentId
      ).catch(console.error);
    } else {
      // REJECTED — notify admin/receptionist
      notifyAdminAndReceptionist(
        "REASSIGNMENT_REQUEST",
        "Reassignment Rejected",
        `Dr. ${existing.toDoctor.name} rejected the reassignment request`,
        id
      ).catch(console.error);
    }

    return NextResponse.json(updated);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2025")
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    console.error("[PATCH /api/doctor-reassignment/[id]] error:", err);
    return NextResponse.json({ error: "Failed to update reassignment" }, { status: 500 });
  }
}
