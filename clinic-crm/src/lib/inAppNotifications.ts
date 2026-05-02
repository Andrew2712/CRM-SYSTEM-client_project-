/**
 * src/lib/inAppNotifications.ts  (NEW FILE)
 * ─────────────────────────────────────────────────────────────────────────────
 * Helpers to create in-app notifications for all CRM events.
 * Wraps prisma.inAppNotification.create in a non-throwing utility.
 */

import { prisma } from "@/lib/prisma";
import { InAppNotifType } from "@prisma/client";

/** Create an in-app notification for a single user (non-throwing) */
export async function createInAppNotification(
  userId: string,
  type: InAppNotifType,
  title: string,
  body: string,
  entityId?: string
): Promise<void> {
  try {
    await prisma.inAppNotification.create({
      data: { userId, type, title, body, entityId },
    });
  } catch (err) {
    console.error("[InApp] Failed to create notification:", err);
  }
}

/** Broadcast an in-app notification to multiple users */
export async function broadcastInAppNotification(
  userIds: string[],
  type: InAppNotifType,
  title: string,
  body: string,
  entityId?: string
): Promise<void> {
  await Promise.all(
    userIds.map((userId) =>
      createInAppNotification(userId, type, title, body, entityId)
    )
  );
}

/** Notify all ADMIN and RECEPTIONIST users */
export async function notifyAdminAndReceptionist(
  type: InAppNotifType,
  title: string,
  body: string,
  entityId?: string
): Promise<void> {
  try {
    const staff = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "RECEPTIONIST"] } },
      select: { id: true },
    });
    await broadcastInAppNotification(
      staff.map((s) => s.id),
      type,
      title,
      body,
      entityId
    );
  } catch (err) {
    console.error("[InApp] Failed to notify admin/receptionist:", err);
  }
}

/** Notify all DOCTOR users */
export async function notifyAllDoctors(
  type: InAppNotifType,
  title: string,
  body: string,
  entityId?: string
): Promise<void> {
  try {
    const doctors = await prisma.user.findMany({
      where: { role: "DOCTOR" },
      select: { id: true },
    });
    await broadcastInAppNotification(
      doctors.map((d) => d.id),
      type,
      title,
      body,
      entityId
    );
  } catch (err) {
    console.error("[InApp] Failed to notify doctors:", err);
  }
}
