/**
 * src/app/api/appointments/route.ts
 * GET  /api/appointments — list (RBAC scoped)
 * POST /api/appointments — create (transaction-safe, overlap-protected)
 *
 * ─── WHAT CHANGED (POST only) ───────────────────────────────────────────────
 *
 * BEFORE (buggy):
 *   1. findFirst() to check if slot is taken   ← outside any transaction
 *   2. create() if no conflict found            ← separate DB round-trip
 *
 * The gap between steps 1 and 2 is a classic TOCTOU (time-of-check /
 * time-of-use) race condition. Two simultaneous requests both pass the
 * findFirst() check before either commits its create(), and both succeed —
 * producing a double booking.
 *
 * AFTER (fixed):
 *   All validation + creation happens inside a single prisma.$transaction()
 *   with Serializable isolation. PostgreSQL guarantees that no two concurrent
 *   serialisable transactions can both "see empty slot → insert" at the same
 *   time; one will be aborted with a serialisation error, which Prisma
 *   surfaces as error code P2034.  We catch P2034 and retry automatically
 *   (standard practice for optimistic-concurrency workloads).
 *
 *   Additionally, the overlap query is now full-interval aware:
 *     startTime < newEnd AND endTime > newStart
 *   instead of the old exact-match on startTime.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, getAppointmentFilter } from "@/lib/rbac";
import { SessionType } from "@prisma/client";
import { sendBookingConfirmations } from "@/lib/notificationWorkflow";
import { toIST } from "@/lib/timezone";
import { rateLimitRead, rateLimitWrite, rateLimitResponse } from "@/lib/rateLimit";
import { auditAppointment } from "@/lib/audit";
import { findOverlappingAppointment } from "@/lib/bookingConflict";

// How many times to retry on a serialisation collision before giving up.
const MAX_RETRIES = 3;

export async function GET(req: NextRequest) {
  const rl = await rateLimitRead(req);
  if (!rl.success) return rateLimitResponse(rl);

  let session;
  try { session = await requireAuth(); } catch (err) { return err as NextResponse; }

  try {
    const from = req.nextUrl.searchParams.get("from");
    const to   = req.nextUrl.searchParams.get("to");
    const roleFilter = getAppointmentFilter(session);

    const appointments = await prisma.appointment.findMany({
      where: {
        ...roleFilter,
        ...(from && to ? { startTime: { gte: new Date(from), lt: new Date(to) } } : {}),
      },
      orderBy: { startTime: "desc" },
      take: 50,
      include: {
        patient: {
          select: { id: true, name: true, patientCode: true, phase: true, totalSessionsPlanned: true, purposeOfVisit: true, status: true },
        },
        doctor: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(appointments);
  } catch (error) {
    console.error("GET /appointments error:", error);
    return NextResponse.json({ error: "Failed to fetch appointments" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const rl = await rateLimitWrite(req);
  if (!rl.success) return rateLimitResponse(rl);

  let session;
  try { session = await requireAuth(); } catch (err) { return err as NextResponse; }

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const { patientId, doctorId, sessionType, startTime, endTime } = body;

  // ── Input validation (outside transaction — fast fail) ──────────────────
  if (!patientId || !doctorId || !sessionType || !startTime || !endTime)
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  if (session.user.role === "DOCTOR" && doctorId !== session.user.id)
    return NextResponse.json({ error: "Doctors can only create appointments for themselves" }, { status: 403 });

  const start = new Date(startTime);
  const end   = new Date(endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime()))
    return NextResponse.json({ error: "Invalid date format for startTime or endTime" }, { status: 400 });

  if (start >= end)
    return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });

  // ── Doctor / patient existence checks (outside transaction — read-only) ──
  const doctor = await prisma.user.findUnique({ where: { id: doctorId }, select: { id: true, isActive: true } });
  if (!doctor)     return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  if (!doctor.isActive) return NextResponse.json({ error: "Cannot book with a deactivated doctor" }, { status: 400 });

  const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true, name: true, isActive: true } });
  if (!patient)    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  if (!patient.isActive) return NextResponse.json({ error: "Cannot book for a deactivated patient" }, { status: 400 });

  // ── Transaction-safe booking with automatic retry on serialisation error ──
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const appointment = await prisma.$transaction(
        async (tx) => {
          // STEP 1: Overlap check INSIDE the transaction.
          // This SELECT is part of the serialisable snapshot; concurrent
          // transactions that also try to book the same slot will collide here
          // and one will be aborted by PostgreSQL.
          const conflict = await findOverlappingAppointment(tx, {
            doctorId,
            newStartTime: start,
            newEndTime:   end,
          });

          if (conflict) {
            // Throw a typed sentinel so we can distinguish a conflict from a
            // generic DB error outside the transaction callback.
            throw Object.assign(
              new Error("SLOT_CONFLICT"),
              { code: "SLOT_CONFLICT" }
            );
          }

          // STEP 2: Create appointment atomically.
          const appt = await tx.appointment.create({
            data: {
              patientId,
              doctorId,
              sessionType: sessionType as SessionType,
              startTime:   start,
              endTime:     end,
              status:      "CONFIRMED",
            },
            include: {
              patient: true,
              doctor:  { select: { id: true, name: true } },
            },
          });

          // STEP 3: Flip patient to RETURNING if they have prior appointments.
          const apptCount = await tx.appointment.count({ where: { patientId } });
          if (apptCount > 1) {
            await tx.patient.update({ where: { id: patientId }, data: { status: "RETURNING" } });
          }

          return appt;
        },
        {
          // Serializable isolation prevents phantom reads / TOCTOU races.
          isolationLevel: "Serializable",
          // 8-second timeout — generous for a booking write.
          timeout: 8000,
        }
      );

      // ── Post-commit side effects (outside tx — failures don't roll back booking) ──
      sendBookingConfirmations(appointment.id).catch(err =>
        console.error("[Notifications]", err)
      );

      await auditAppointment(session, req, "CREATE", appointment.id, {
        patientName: patient.name,
        new: { patientId, doctorId, sessionType, startTime, endTime, status: "CONFIRMED" },
      });

      return NextResponse.json(appointment, { status: 201 });

    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };

      // ── Known: slot was taken ────────────────────────────────────────────
      if (e?.code === "SLOT_CONFLICT") {
        return NextResponse.json(
          { success: false, error: "This slot has already been booked. Please choose a different time." },
          { status: 409 }
        );
      }

      // ── Known: Prisma serialisation collision → retry ────────────────────
      // P2034 = "Transaction failed due to a write conflict or a deadlock"
      if (e?.code === "P2034") {
        lastError = err;
        // Small jitter before retry to reduce thundering-herd
        await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
        continue;
      }

      // ── Unknown error ─────────────────────────────────────────────────────
      console.error("POST /appointments error:", err);
      return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 });
    }
  }

  // All retries exhausted (P2034 kept firing — extremely rare under normal load)
  console.error("POST /appointments: serialisation retries exhausted", lastError);
  return NextResponse.json(
    { error: "The system is busy. Please try again in a moment." },
    { status: 503 }
  );
}
