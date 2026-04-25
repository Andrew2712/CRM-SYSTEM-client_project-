/**
 * src/app/api/staff/[id]/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * GET    /api/staff/[id]  → fetch a specific staff member's profile (by ID)
 * DELETE /api/staff/[id]  → permanently remove a staff member (ADMIN only)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  // ADMINs can view any staff profile; other roles can only view their own
  if (session.user.role !== "ADMIN" && session.user.id !== id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id },
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
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("[GET /api/staff/[id]] error:", error);
    return NextResponse.json(
      { error: "Failed to load staff profile" },
      { status: 500 }
    );
  }
}

// ── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only admins can remove staff members" },
      { status: 403 }
    );
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  // Prevent admin from accidentally deleting their own account
  if (session.user.id === id) {
    return NextResponse.json(
      { error: "You cannot remove your own account" },
      { status: 400 }
    );
  }

  try {
    // Delete related notifications first to satisfy foreign key constraints
    await prisma.notification.deleteMany({
      where: { appointment: { doctorId: id } },
    });

    // Delete related appointments
    await prisma.appointment.deleteMany({
      where: { doctorId: id },
    });

    // Finally delete the user
    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.code === "P2025") {
      return NextResponse.json(
        { error: "Staff member not found" },
        { status: 404 }
      );
    }
    console.error("[DELETE /api/staff/[id]] error:", err);
    return NextResponse.json(
      { error: "Failed to remove staff member" },
      { status: 500 }
    );
  }
}