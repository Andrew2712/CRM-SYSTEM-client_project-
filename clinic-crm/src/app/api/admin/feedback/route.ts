/**
 * src/app/api/admin/feedback/route.ts
 *
 * GET /api/admin/feedback — Admin/Doctor view all patient feedbacks
 *
 * Query params:
 *   page   (default 1)
 *   limit  (default 20, max 50)
 *   search (patient name filter)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/rbac";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, ["ADMIN", "DOCTOR", "RECEPTIONIST"]);

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get("page")  ?? "1"));
    const limit  = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? "20")));
    const search = searchParams.get("search")?.trim() ?? "";

    const where: Record<string, unknown> = {};
    if (search) {
      where.patient = { name: { contains: search, mode: "insensitive" } };
    }

    const [feedbacks, total] = await Promise.all([
      prisma.patientFeedback.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * limit,
        take:    limit,
        include: {
          patient: { select: { name: true, patientCode: true } },
          appointment: {
            select: {
              startTime:   true,
              sessionType: true,
              doctor: { select: { name: true } },
            },
          },
        },
      }),
      prisma.patientFeedback.count({ where }),
    ]);

    return NextResponse.json({
      feedbacks,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    if (err instanceof NextResponse) throw err;
    logger.error("GET /api/admin/feedback failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
