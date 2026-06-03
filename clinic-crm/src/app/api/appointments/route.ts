/**
 * src/app/api/appointments/route.ts
 * GET  /api/appointments — list (RBAC scoped, cursor-paginated)
 * POST /api/appointments — create (transaction-safe, overlap-protected)
 *
 * Pagination query params:
 *   cursor   — the `id` of the last item from the previous page (optional)
 *   limit    — items per page, 1–100, defaults to 50
 *
 * Response shape:
 *   { data: Appointment[], nextCursor: string | null, hasMore: boolean }
 *
 * Client usage:
 *   Page 1:  GET /api/appointments?limit=50
 *   Page 2:  GET /api/appointments?limit=50&cursor=<lastId>
 *   Stop when hasMore === false.
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
import { validateEnv } from "@/lib/envValidation";

export const maxDuration = 30;

const MAX_RETRIES = 3;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(req: NextRequest) {
  const rl = await rateLimitRead(req);
  if (!rl.success) return rateLimitResponse(rl);

  let session;
  try { session = await requireAuth(); } catch (err) { return err as NextResponse; }

  try {
    const params   = req.nextUrl.searchParams;
    const from     = params.get("from");
    const to       = params.get("to");
    const cursor   = params.get("cursor") ?? undefined;
    const rawLimit = parseInt(params.get("limit") ?? String(DEFAULT_LIMIT), 10);
    const limit    = Math.min(Math.max(isNaN(rawLimit) ? DEFAULT_LIMIT : rawLimit, 1), MAX_LIMIT);

    const roleFilter = getAppointmentFilter(session);

    // Fetch limit+1 to determine whether a next page exists.
    // orderBy includes `id` as a tiebreaker so the cursor position is always
    // unique — without it, non-unique `startTime` values cause Prisma to skip
    // or duplicate records across pages.
    const rows = await prisma.appointment.findMany({
      where: {
        ...roleFilter,
        ...(from && to ? { startTime: { gte: new Date(from), lt: new Date(to) } } : {}),
      },
      orderBy: [
        { startTime: "desc" },
        { id: "desc" },           // tiebreaker — makes cursor position unique
      ],
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: {
        patient: {
          select: {
            id: true, name: true, patientCode: true,
            phase: true, totalSessionsPlanned: true,
            purposeOfVisit: true, status: true,
          },
        },
        doctor: { select: { id: true, name: true } },
      },
    });

    const hasMore    = rows.length > limit;
    const data       = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return NextResponse.json({ data, nextCursor, hasMore });
  } catch (error) {
    console.error("GET /appointments error:", error);
    return NextResponse.json({ error: "Failed to fetch appointments" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // ── Env validation (production only — dev may not have all vars set) ────────
  if (process.env.NODE_ENV === "production") {
    try { validateEnv(); } catch (err) {
      console.error(err);
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }
  }

  const rl = await rateLimitWrite(req);
  if (!rl.success) return rateLimitResponse(rl);

  let session;
  try { session = await requireAuth(); } catch (err) { return err as NextResponse; }

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const { patientId, doctorId, sessionType, startTime, endTime } = body;

  // ── Input validation ──────────────────────────────────────────────────────
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

  // ── Doctor / patient existence checks ─────────────────────────────────────
  const doctor = await prisma.user.findUnique({ where: { id: doctorId }, select: { id: true, isActive: true } });
  if (!doctor)          return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  if (!doctor.isActive) return NextResponse.json({ error: "Cannot book with a deactivated doctor" }, { status: 400 });

  const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true, name: true, isActive: true } });
  if (!patient)          return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  if (!patient.isActive) return NextResponse.json({ error: "Cannot book for a deactivated patient" }, { status: 400 });

  // ── Transaction-safe booking with retry on serialisation error ────────────
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const appointment = await prisma.$transaction(
        async (tx) => {
          const conflict = await findOverlappingAppointment(tx, {
            doctorId,
            newStartTime: start,
            newEndTime:   end,
          });

          if (conflict) {
            throw Object.assign(new Error("SLOT_CONFLICT"), { code: "SLOT_CONFLICT" });
          }

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

          const apptCount = await tx.appointment.count({ where: { patientId } });
          if (apptCount > 1) {
            await tx.patient.update({ where: { id: patientId }, data: { status: "RETURNING" } });
          }

          return appt;
        },
        {
          isolationLevel: "Serializable",
          timeout: 8000,
        }
      );

      // ── Await notifications before returning ──────────────────────────────
      try {
        await sendBookingConfirmations(appointment.id);
      } catch (notifErr) {
        console.error(
          "[Notifications] Booking confirmations failed (non-fatal, booking still created):",
          notifErr
        );
      }

      await auditAppointment(session, req, "CREATE", appointment.id, {
        patientName: patient.name,
        new: { patientId, doctorId, sessionType, startTime, endTime, status: "CONFIRMED" },
      });

      return NextResponse.json(appointment, { status: 201 });

    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };

      if (e?.code === "SLOT_CONFLICT") {
        return NextResponse.json(
          { success: false, error: "This slot has already been booked. Please choose a different time." },
          { status: 409 }
        );
      }

      if (e?.code === "P2034") {
        lastError = err;
        await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
        continue;
      }

      console.error("POST /appointments error:", err);
      return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 });
    }
  }

  console.error("POST /appointments: serialisation retries exhausted", lastError);
  return NextResponse.json(
    { error: "The system is busy. Please try again in a moment." },
    { status: 503 }
  );
}