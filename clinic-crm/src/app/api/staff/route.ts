/**
 * src/app/api/staff/route.ts
 * GET /api/staff — list staff (ADMIN only, cursor-paginated)
 *
 * Pagination query params:
 *   cursor          — id of the last item from previous page (optional)
 *   limit           — items per page, 1–100, defaults to 50
 *   includeInactive — "true" to include soft-deleted staff (default: false)
 *
 * Response shape:
 *   { staff: User[], nextCursor: string | null, hasMore: boolean }
 *
 * Client usage:
 *   Page 1:  GET /api/staff?limit=50
 *   Page 2:  GET /api/staff?limit=50&cursor=<lastId>
 *   Stop when hasMore === false.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/rbac";
import { rateLimitAdmin, rateLimitResponse } from "@/lib/rateLimit";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

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
    const params          = req.nextUrl.searchParams;
    const includeInactive = params.get("includeInactive") === "true";
    const cursor          = params.get("cursor") ?? undefined;
    const rawLimit        = parseInt(params.get("limit") ?? String(DEFAULT_LIMIT), 10);
    const limit           = Math.min(Math.max(isNaN(rawLimit) ? DEFAULT_LIMIT : rawLimit, 1), MAX_LIMIT);

    // Fetch limit+1 to determine whether a next page exists.
    // orderBy includes `id` as the final tiebreaker — the compound sort
    // [role, name] is non-unique (staff can share role and name), so without
    // `id` Prisma cannot reliably locate the cursor row and will skip or
    // duplicate records across pages.
    const rows = await prisma.user.findMany({
      where: includeInactive ? {} : { isActive: true },
      select: {
        id: true, name: true, email: true, role: true,
        phone: true, createdAt: true, isActive: true, deletedAt: true,
      },
      orderBy: [
        { role: "asc" },
        { name: "asc" },
        { id: "asc" },            // tiebreaker — makes cursor position unique
      ],
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const hasMore    = rows.length > limit;
    const staff      = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? staff[staff.length - 1].id : null;

    return NextResponse.json({ staff, nextCursor, hasMore });
  } catch (error) {
    console.error("Staff registry error:", error);
    return NextResponse.json({ error: "Failed to load staff members" }, { status: 500 });
  }
}