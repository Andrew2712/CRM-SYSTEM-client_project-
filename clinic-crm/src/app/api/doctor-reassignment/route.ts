/**
 * src/app/api/doctor-reassignment/route.ts  (NEW FILE)
 * ─────────────────────────────────────────────────────────────────────────────
 * GET  /api/doctor-reassignment  → list requests
 * POST /api/doctor-reassignment  → create reassignment request (ADMIN / RECEPTIONIST)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { createInAppNotification, notifyAdminAndReceptionist } from "@/lib/inAppNotifications";

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  let session;
  try { session = await requireAuth(); } catch (e) { return e as NextResponse; }

  const where =
    session.user.role === "DOCTOR"
      ? {
          OR: [
            { toDoctorId: session.user.id },
            { fromDoctorId: session.user.id },
          ],
        }
      : {};

  const requests = await prisma.doctorReassignmentRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      appointment: {
        include: { patient: true },
      },
      fromDoctor: { select: { id: true, name: true } },
      toDoctor:   { select: { id: true, name: true } },
      requestedBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(requests);
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let session;
  try { session = await requireAuth(); } catch (e) { return e as NextResponse; }

  if (!["ADMIN", "RECEPTIONIST"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { appointmentId: string; toDoctorId: string; notes?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.appointmentId || !body.toDoctorId) {
    return NextResponse.json({ error: "appointmentId and toDoctorId are required" }, { status: 400 });
  }

  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: body.appointmentId },
      include: { patient: true, doctor: true },
    });

    if (!appointment)
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });

    const request = await prisma.doctorReassignmentRequest.create({
      data: {
        appointmentId:     body.appointmentId,
        requestedByUserId: session.user.id,
        fromDoctorId:      appointment.doctorId,
        toDoctorId:        body.toDoctorId,
        notes:             body.notes,
      },
      include: {
        fromDoctor: { select: { id: true, name: true } },
        toDoctor:   { select: { id: true, name: true } },
        appointment: { include: { patient: true } },
      },
    });

    // Notify the target doctor
    createInAppNotification(
      body.toDoctorId,
      "REASSIGNMENT_REQUEST",
      "Reassignment Request",
      `You have been requested to take over ${appointment.patient.name}'s appointment from Dr. ${appointment.doctor.name}`,
      request.id
    ).catch(console.error);

    return NextResponse.json(request, { status: 201 });
  } catch (err) {
    console.error("[POST /api/doctor-reassignment] error:", err);
    return NextResponse.json({ error: "Failed to create reassignment request" }, { status: 500 });
  }
}
