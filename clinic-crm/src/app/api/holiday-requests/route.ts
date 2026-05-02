/**
 * src/app/api/holiday-requests/route.ts  (NEW FILE)
 * ─────────────────────────────────────────────────────────────────────────────
 * GET  /api/holiday-requests  → list (ADMIN / RECEPTIONIST see all; DOCTOR sees own)
 * POST /api/holiday-requests  → create (DOCTOR only)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { notifyAdminAndReceptionist } from "@/lib/inAppNotifications";

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  let session;
  try { session = await requireAuth(); } catch (e) { return e as NextResponse; }

  const where =
    session.user.role === "DOCTOR" ? { doctorId: session.user.id } : {};

  const requests = await prisma.holidayRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      doctor: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(requests);
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let session;
  try { session = await requireAuth(); } catch (e) { return e as NextResponse; }

  if (session.user.role !== "DOCTOR") {
    return NextResponse.json({ error: "Only doctors can submit holiday requests" }, { status: 403 });
  }

  let body: { date: string; reason: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.date || !body.reason) {
    return NextResponse.json({ error: "date and reason are required" }, { status: 400 });
  }

  try {
    const request = await prisma.holidayRequest.create({
      data: {
        doctorId: session.user.id,
        date: new Date(body.date),
        reason: body.reason,
      },
      include: {
        doctor: { select: { id: true, name: true } },
      },
    });

    // In-app notification to admin/receptionist
    notifyAdminAndReceptionist(
      "HOLIDAY_REQUEST",
      "New Holiday Request",
      `Dr. ${session.user.name} has submitted a holiday request for ${new Date(body.date).toLocaleDateString("en-IN")}`,
      request.id
    ).catch(console.error);

    return NextResponse.json(request, { status: 201 });
  } catch (err) {
    console.error("[POST /api/holiday-requests] error:", err);
    return NextResponse.json({ error: "Failed to create holiday request" }, { status: 500 });
  }
}
