import { prisma } from "@/lib/prisma";
import { InAppNotifType } from "@prisma/client";

export async function createInAppNotification(
  userId: string,
  type: InAppNotifType,
  title: string,
  body: string,
  entityId?: string
) {
  try {
    return await prisma.inAppNotification.create({
      data: {
        userId,
        type,
        title,
        body,
        entityId,
        read: false,
      },
    });
  } catch (error) {
    console.error("[inAppNotifications] Failed to create notification:", error);
  }
}

export async function notifyAdminAndReceptionist(
  type: InAppNotifType,
  title: string,
  body: string,
  entityId?: string
) {
  try {
    const staff = await prisma.user.findMany({
      where: {
        role: { in: ["ADMIN", "RECEPTIONIST"] },
        isActive: true,
      },
      select: { id: true },
    });

    await Promise.all(
      staff.map((user) =>
        createInAppNotification(user.id, type, title, body, entityId)
      )
    );
  } catch (error) {
    console.error("[inAppNotifications] Failed to notify staff:", error);
  }
}
