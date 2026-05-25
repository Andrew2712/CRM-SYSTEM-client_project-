/**
 * src/app/api/waitlist/[id]/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * PATCH /api/waitlist/:id — update status / priority / notes
 * DELETE /api/waitlist/:id — cancel (soft) a waitlist entry
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/rbac";
import { rateLimitWrite, rateLimitResponse } from "@/lib/rateLimit";
import { WaitlistStatus } from "@prisma/client";

const VALID_STATUSES: WaitlistStatus[] = [
  "PENDING", "NOTIFIED", "ACCEPTED", "EXPIRED", "CANCELLED",
];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rl = await rateLimitWrite(req);
  if (!rl.success) return rateLimitResponse(rl);

  let session;
  try { session = await requireAuth(); } catch (e) { return e as NextResponse; }

  try { requireRole(session, ["ADMIN", "RECEPTIONIST"]); }
  catch (e) { return e as NextResponse; }

  const { id } = await params;

  let body: {
    status?: WaitlistStatus;
    priority?: number;
    notes?: string;
    preferredDate?: string;
    preferredTime?: string;
  };

  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  if (body.status && !VALID_STATUSES.includes(body.status))
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  try {
    const entry = await prisma.waitlist.findUnique({ where: { id } });
    if (!entry)
      return NextResponse.json({ error: "Waitlist entry not found" }, { status: 404 });

    const updated = await prisma.waitlist.update({
      where: { id },
      data: {
        ...(body.status        !== undefined ? { status:        body.status }                     : {}),
        ...(body.priority      !== undefined ? { priority:      body.priority }                   : {}),
        ...(body.notes         !== undefined ? { notes:         body.notes }                      : {}),
        ...(body.preferredDate !== undefined ? { preferredDate: new Date(body.preferredDate) }    : {}),
        ...(body.preferredTime !== undefined ? { preferredTime: body.preferredTime }              : {}),
      },
      include: {
        patient: { select: { id: true, name: true, patientCode: true } },
        doctor:  { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/waitlist/:id]", err);
    return NextResponse.json({ error: "Failed to update waitlist entry" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rl = await rateLimitWrite(req);
  if (!rl.success) return rateLimitResponse(rl);

  let session;
  try { session = await requireAuth(); } catch (e) { return e as NextResponse; }

  try { requireRole(session, ["ADMIN", "RECEPTIONIST"]); }
  catch (e) { return e as NextResponse; }

  const { id } = await params;

  try {
    await prisma.waitlist.update({
      where: { id },
      data:  { status: "CANCELLED" },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Waitlist entry not found" }, { status: 404 });
  }
}
