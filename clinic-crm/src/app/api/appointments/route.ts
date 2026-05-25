/**
 * src/app/api/appointments/route.ts
 * GET  /api/appointments — list (RBAC scoped)
 * POST /api/appointments — create
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, getAppointmentFilter } from "@/lib/rbac";
import { SessionType } from "@prisma/client";
import { sendBookingConfirmations } from "@/lib/notificationWorkflow";
import { toIST } from "@/lib/timezone";
import { rateLimitRead, rateLimitWrite, rateLimitResponse } from "@/lib/rateLimit";
import { auditAppointment } from "@/lib/audit";

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

  if (!patientId || !doctorId || !sessionType || !startTime || !endTime)
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  if (session.user.role === "DOCTOR" && doctorId !== session.user.id)
    return NextResponse.json({ error: "Doctors can only create appointments for themselves" }, { status: 403 });

  try {
    const start = new Date(startTime);
    const end   = new Date(endTime);

    if (start >= end)
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });

    const doctor = await prisma.user.findUnique({ where: { id: doctorId }, select: { id: true, isActive: true } });
    if (!doctor)   return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
    if (!doctor.isActive) return NextResponse.json({ error: "Cannot book with a deactivated doctor" }, { status: 400 });

    const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true, name: true, isActive: true } });
    if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    if (!patient.isActive) return NextResponse.json({ error: "Cannot book for a deactivated patient" }, { status: 400 });

    const conflict = await prisma.appointment.findFirst({
      where: { doctorId, startTime: start, status: { in: ["CONFIRMED", "ATTENDED"] } },
    });
    if (conflict) return NextResponse.json({ error: "This slot is already booked for this doctor" }, { status: 409 });

    const appointment = await prisma.appointment.create({
      data: { patientId, doctorId, sessionType: sessionType as SessionType, startTime: start, endTime: end, status: "CONFIRMED" },
      include: { patient: true, doctor: { select: { id: true, name: true } } },
    });

    const apptCount = await prisma.appointment.count({ where: { patientId } });
    if (apptCount > 1) await prisma.patient.update({ where: { id: patientId }, data: { status: "RETURNING" } });

    sendBookingConfirmations(appointment.id).catch(err => console.error("[Notifications]", err));

    // ── Audit ──
    await auditAppointment(session, req, "CREATE", appointment.id, {
      patientName: patient.name,
      new: { patientId, doctorId, sessionType, startTime, endTime, status: "CONFIRMED" },
    });

    return NextResponse.json(appointment, { status: 201 });
  } catch (error) {
    console.error("POST /appointments error:", error);
    return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 });
  }
}
