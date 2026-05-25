/**
 * GET /api/admin/audit-logs
 * Paginated audit log viewer — ADMIN only
 * Supports: search, entity filter, action filter, date range, pagination
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/rbac";
import { rateLimitAdmin, rateLimitResponse } from "@/lib/rateLimit";
import { AuditAction } from "@prisma/client";

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

  const { searchParams } = req.nextUrl;
  const search    = searchParams.get("search")    ?? "";
  const entity    = searchParams.get("entity")    ?? "";
  const action    = searchParams.get("action")    ?? "";
  const userId    = searchParams.get("userId")    ?? "";
  const dateFrom  = searchParams.get("dateFrom")  ?? "";
  const dateTo    = searchParams.get("dateTo")    ?? "";
  const page      = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
  const limit     = Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10));
  const skip      = (page - 1) * limit;

  try {
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { description: { contains: search, mode: "insensitive" } },
        { userName:    { contains: search, mode: "insensitive" } },
        { entityId:    { contains: search, mode: "insensitive" } },
      ];
    }
    if (entity) where.entity = entity;
    if (userId) where.userId = userId;
    if (action && Object.values(AuditAction).includes(action as AuditAction))
      where.action = action as AuditAction;
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo)   { const end = new Date(dateTo); end.setHours(23, 59, 59, 999); dateFilter.lte = end; }
      where.createdAt = dateFilter;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip, take: limit,
        include: { user: { select: { id: true, name: true, role: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/admin/audit-logs error:", error);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
