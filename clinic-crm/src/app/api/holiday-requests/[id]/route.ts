/**
 * src/app/api/holiday-requests/[id]/route.ts  (NEW FILE)
 * ─────────────────────────────────────────────────────────────────────────────
 * PATCH /api/holiday-requests/:id → approve / reject (ADMIN + RECEPTIONIST)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { createInAppNotification } from "@/lib/inAppNotifications";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try { session = await requireAuth(); } catch (e) { return e as NextResponse; }

  if (!["ADMIN", "RECEPTIONIST"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  let body: { status: "APPROVED" | "REJECTED" };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!["APPROVED", "REJECTED"].includes(body.status)) {
    return NextResponse.json({ error: "status must be APPROVED or REJECTED" }, { status: 400 });
  }

  try {
    const request = await prisma.holidayRequest.update({
      where: { id },
      data: { status: body.status },
      include: { doctor: { select: { id: true, name: true } } },
    });

    // Notify the doctor
    createInAppNotification(
      request.doctorId,
      "HOLIDAY_REQUEST",
      `Holiday Request ${body.status === "APPROVED" ? "Approved ✅" : "Rejected ❌"}`,
      `Your holiday request for ${new Date(request.date).toLocaleDateString("en-IN")} has been ${body.status.toLowerCase()}`,
      id
    ).catch(console.error);

    return NextResponse.json(request);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2025")
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    console.error("[PATCH /api/holiday-requests/[id]] error:", err);
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
  }
}
