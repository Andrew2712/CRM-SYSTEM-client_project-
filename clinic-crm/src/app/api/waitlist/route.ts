/**
 * src/app/api/waitlist/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * GET  /api/waitlist — list waitlist entries (RBAC scoped)
 * POST /api/waitlist — add a patient to the waitlist
 *
 * Access:
 *   ADMIN        — full read + write
 *   RECEPTIONIST — full read + write
 *   DOCTOR       — read only (their own patients' entries)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/rbac";
import { rateLimitRead, rateLimitWrite, rateLimitResponse } from "@/lib/rateLimit";

// ─── GET /api/waitlist ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const rl = await rateLimitRead(req);
  if (!rl.success) return rateLimitResponse(rl);

  let session;
  try { session = await requireAuth(); } catch (e) { return e as NextResponse; }

  const { searchParams } = req.nextUrl;
  const status   = searchParams.get("status");    // filter by status
  const doctorId = searchParams.get("doctorId");  // filter by doctor
  const page     = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit    = Math.min(100, Number(searchParams.get("limit") ?? "50"));
  const skip     = (page - 1) * limit;

  // DOCTOR sees only their own patients' entries
  const doctorFilter =
    session.user.role === "DOCTOR" ? session.user.id : (doctorId ?? undefined);

  const where: Record<string, unknown> = {};
  if (status)       where.status   = status;
  if (doctorFilter) where.doctorId = doctorFilter;

  try {
    const [entries, total] = await Promise.all([
      prisma.waitlist.findMany({
        where,
        orderBy: [
          { priority: "desc" },
          { createdAt: "asc" },
        ],
        skip,
        take: limit,
        include: {
          patient: {
            select: {
              id: true, name: true, patientCode: true,
              phone: true, email: true, phase: true,
            },
          },
          doctor: { select: { id: true, name: true } },
        },
      }),
      prisma.waitlist.count({ where }),
    ]);

    return NextResponse.json({
      entries,
      total,
      page,
      pageCount: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[GET /api/waitlist]", err);
    return NextResponse.json({ error: "Failed to fetch waitlist" }, { status: 500 });
  }
}

// ─── POST /api/waitlist ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rl = await rateLimitWrite(req);
  if (!rl.success) return rateLimitResponse(rl);

  let session;
  try { session = await requireAuth(); } catch (e) { return e as NextResponse; }

  try { requireRole(session, ["ADMIN", "RECEPTIONIST"]); }
  catch (e) { return e as NextResponse; }

  let body: {
    patientId: string;
    doctorId: string;
    preferredDate: string;
    preferredTime?: string;
    priority?: number;
    notes?: string;
  };

  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const { patientId, doctorId, preferredDate, preferredTime, priority, notes } = body;

  if (!patientId || !doctorId || !preferredDate)
    return NextResponse.json(
      { error: "patientId, doctorId, and preferredDate are required" },
      { status: 400 }
    );

  try {
    // Validate patient + doctor exist and are active
    const [patient, doctor] = await Promise.all([
      prisma.patient.findUnique({ where: { id: patientId }, select: { id: true, name: true, isActive: true } }),
      prisma.user.findUnique({ where: { id: doctorId },    select: { id: true, name: true, isActive: true, role: true } }),
    ]);

    if (!patient || !patient.isActive)
      return NextResponse.json({ error: "Patient not found or inactive" }, { status: 404 });
    if (!doctor || !doctor.isActive || doctor.role !== "DOCTOR")
      return NextResponse.json({ error: "Doctor not found or inactive" }, { status: 404 });

    // Prevent duplicate PENDING entries for the same patient+doctor+date
    const duplicate = await prisma.waitlist.findFirst({
      where: {
        patientId,
        doctorId,
        preferredDate: new Date(preferredDate),
        status: "PENDING",
      },
    });
    if (duplicate)
      return NextResponse.json(
        { error: "Patient already has a PENDING waitlist entry for this doctor on this date" },
        { status: 409 }
      );

    const entry = await prisma.waitlist.create({
      data: {
        patientId,
        doctorId,
        preferredDate: new Date(preferredDate),
        preferredTime: preferredTime ?? null,
        priority:      priority ?? 0,
        notes:         notes ?? null,
        // Auto-expire after 48 h if not acted upon
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
      include: {
        patient: { select: { id: true, name: true, patientCode: true } },
        doctor:  { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    console.error("[POST /api/waitlist]", err);
    return NextResponse.json({ error: "Failed to add to waitlist" }, { status: 500 });
  }
}
