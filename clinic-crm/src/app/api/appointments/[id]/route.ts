/**
 * src/app/api/appointments/[id]/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * PATCH /api/appointments/:id
 * → Update appointment status + notes
 *
 * Rules:
 * - Must be authenticated
 * - Only ADMIN / DOCTOR allowed
 * - DOCTOR can only modify their own appointments
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  requireAuth,
  requireRole,
  assertCanAccessAppointment,
} from "@/lib/rbac";

const VALID_STATUSES = ["ATTENDED", "MISSED", "CONFIRMED", "CANCELLED"] as const;
type UpdatableStatus = (typeof VALID_STATUSES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// ✅ PATCH
// ─────────────────────────────────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1️⃣ Auth
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    return err as NextResponse;
  }

  // 2️⃣ Role check
  try {
    requireRole(session, ["ADMIN", "DOCTOR"]);
  } catch (err) {
    return err as NextResponse;
  }

  const { id } = await params;

  // 3️⃣ Ownership check (DOCTOR restriction)
  try {
    await assertCanAccessAppointment(id, session);
  } catch (err) {
    return err as NextResponse;
  }

  // 4️⃣ Parse body
  let body: { status: UpdatableStatus; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { status, notes } = body;

  // 5️⃣ Validate status
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Allowed: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    // 6️⃣ Update appointment (status + optional notes if you add field later)
    const appointment = await prisma.appointment.update({
      where: { id },
      data: {
        status,
        ...(notes !== undefined ? { notes } : {}), // ✅ FIXED (your version had empty object)
      },
      include: {
        patient: true,
        doctor: { select: { id: true, name: true } },
      },
    });

    // 7️⃣ If ATTENDED → create/update visit + mark patient RETURNING
    if (status === "ATTENDED") {
      await prisma.patientVisit.upsert({
        where: { appointmentId: id },
        update: {
          status,
          notes: notes ?? null,
        },
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

    // 8️⃣ Cache revalidation (important for Next.js app router)
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/doctor");

    return NextResponse.json(appointment);
  } catch (error) {
    console.error("PATCH /appointments/:id error:", error);
    return NextResponse.json(
      { error: "Failed to update appointment" },
      { status: 500 }
    );
  }
}