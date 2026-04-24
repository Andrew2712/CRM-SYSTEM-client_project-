/**
 * src/app/api/staff/me/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/staff/me
 *
 * Returns the currently authenticated user's full profile.
 * Used by the Staff Dashboard / Profile page.
 * Access: Any authenticated user
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

export async function GET() {
  // ── Auth Guard ─────────────────────────────────────────────────────────────
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Fetch profile ──────────────────────────────────────────────────────────
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id:        true,
        name:      true,
        email:     true,
        role:      true,
        phone:     true,
        createdAt: true,
        _count: {
          select: { appointments: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("[GET /api/staff/me] error:", error);
    return NextResponse.json(
      { error: "Failed to load staff profile" },
      { status: 500 }
    );
  }
}