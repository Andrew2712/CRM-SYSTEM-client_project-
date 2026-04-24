/**
 * src/app/api/staff/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/staff
 *
 * Returns all staff members (Users) with their profile fields.
 * Access: ADMIN only
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/rbac";

export async function GET() {
  // ── Auth + Role Guard ──────────────────────────────────────────────────────
  let session;
  try {
    session = await requireAuth();
    requireRole(session, ["ADMIN"]);
  } catch (err) {
    return err as NextResponse;
  }

  try {
    const staff = await prisma.user.findMany({
      select: {
        id:        true,
        name:      true,
        email:     true,
        role:      true,
        phone:     true,
        createdAt: true,
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