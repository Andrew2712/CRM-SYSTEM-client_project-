/**
 * GET /api/staff — list staff (ADMIN only)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/rbac";
import { rateLimitAdmin, rateLimitResponse } from "@/lib/rateLimit";

export async function GET(req: NextRequest) {
  const rl = await rateLimitAdmin(req);
  if (!rl.success) return rateLimitResponse(rl);

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
      where: includeInactive ? {} : { isActive: true },
      select: { id: true, name: true, email: true, role: true, phone: true, createdAt: true, isActive: true, deletedAt: true },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({ staff });
  } catch (error) {
    console.error("Staff registry error:", error);
    return NextResponse.json({ error: "Failed to load staff members" }, { status: 500 });
  }
}
