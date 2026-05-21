/**
 * src/app/api/staff/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/staff
 *
 * Returns active staff members by default.
 * Pass ?includeInactive=true (ADMIN only) to include deactivated staff.
 * Access: ADMIN only
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  // ── Auth + Role Guard ──────────────────────────────────────────────────────
  let session;
  try {
    session = await requireAuth();
    requireRole(session, ["ADMIN"]);
  } catch (err) {
    return err as NextResponse;
  }

  try {
    const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "true";

    const staff = await prisma.user.findMany({
      where: {
        // Hide deactivated staff unless admin explicitly requests them
        ...(includeInactive ? {} : { isActive: true }),
      },
      select: {
        id:        true,
        name:      true,
        email:     true,
        role:      true,
        phone:     true,
        createdAt: true,
        isActive:  true,
        deletedAt: true,
      },
      orderBy: [
        { role: "asc" },
        { name: "asc" },
      ],
    });

    return NextResponse.json({ staff });
  } catch (error) {
    console.error("Staff registry error:", error);
    return NextResponse.json(
      { error: "Failed to load staff members" },
      { status: 500 }
    );
  }
}