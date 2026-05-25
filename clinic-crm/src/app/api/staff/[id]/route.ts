/**
 * src/app/api/staff/[id]/route.ts
 * GET / PATCH / DELETE
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimitRead, rateLimitWrite, rateLimitAdmin, rateLimitResponse } from "@/lib/rateLimit";
import { auditLog } from "@/lib/audit";
import type { AuthSession } from "@/lib/rbac";

function buildSession(s: Awaited<ReturnType<typeof getServerSession>>): AuthSession {
  return s as AuthSession;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = await rateLimitRead(_req);
  if (!rl.success) return rateLimitResponse(rl);

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  if (session.user.role !== "ADMIN" && session.user.id !== id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, phone: true, createdAt: true, isActive: true, deletedAt: true, _count: { select: { appointments: true } } },
    });
    if (!user) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    return NextResponse.json({ user });
  } catch (error) {
    console.error("[GET /api/staff/[id]] error:", error);
    return NextResponse.json({ error: "Failed to load staff profile" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = await rateLimitWrite(req);
  if (!rl.success) return rateLimitResponse(rl);

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "RECEPTIONIST"].includes(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (session.user.role === "RECEPTIONIST" && session.user.id !== id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  try {
    const before = await prisma.user.findUnique({ where: { id }, select: { name: true, phone: true, email: true } });
    const data: Record<string, unknown> = {};
    if (body.name  !== undefined) data.name  = body.name;
    if (body.phone !== undefined) data.phone = body.phone;
    if (body.email !== undefined && session.user.role === "ADMIN") data.email = body.email;

    const user = await prisma.user.update({
      where: { id }, data,
      select: { id: true, name: true, email: true, role: true, phone: true },
    });

    await auditLog({
      session:     buildSession(session),
      req,
      action:      "UPDATE",
      entity:      "Staff",
      entityId:    id,
      description: `Updated staff profile for "${user.name}"`,
      oldValue:    before as Record<string, unknown>,
      newValue:    data,
    });

    return NextResponse.json({ user });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2025")
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    console.error("[PATCH /api/staff/[id]] error:", err);
    return NextResponse.json({ error: "Failed to update staff profile" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = await rateLimitAdmin(_req);
  if (!rl.success) return rateLimitResponse(rl);

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Only admins can remove staff members" }, { status: 403 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  if (session.user.id === id)
    return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 400 });

  try {
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, isActive: true } });
    if (!user)          return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    if (!user.isActive) return NextResponse.json({ error: "Staff member is already deactivated" }, { status: 409 });

    const deactivated = await prisma.user.update({
      where: { id }, data: { isActive: false, deletedAt: new Date() },
      select: { id: true, name: true, role: true, isActive: true, deletedAt: true },
    });

    await auditLog({
      session:     buildSession(session),
      req:         _req,
      action:      "DELETE",
      entity:      "Staff",
      entityId:    id,
      description: `Deactivated staff account for "${deactivated.name}" (${deactivated.role})`,
      oldValue:    { isActive: true },
      newValue:    { isActive: false },
    });

    return NextResponse.json({ message: `Staff member "${deactivated.name}" has been deactivated.`, user: deactivated });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2025")
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    console.error("[DELETE /api/staff/[id]] error:", err);
    return NextResponse.json({ error: "Failed to deactivate staff member" }, { status: 500 });
  }
}
