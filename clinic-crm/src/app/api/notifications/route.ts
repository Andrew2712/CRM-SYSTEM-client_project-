/**
 * src/app/api/notifications/route.ts  (NEW FILE)
 * ─────────────────────────────────────────────────────────────────────────────
 * GET   /api/notifications         → list (own only)
 * PATCH /api/notifications         → mark all as read
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

export async function GET(_req: NextRequest) {
  let session;
  try { session = await requireAuth(); } catch (e) { return e as NextResponse; }

  const notifications = await prisma.inAppNotification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = await prisma.inAppNotification.count({
    where: { userId: session.user.id, read: false },
  });

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(_req: NextRequest) {
  let session;
  try { session = await requireAuth(); } catch (e) { return e as NextResponse; }

  await prisma.inAppNotification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });

  return NextResponse.json({ success: true });
}
