import { prisma } from "@/lib/prisma";

type NotificationType = "INFO" | "WARNING" | "ERROR" | "SUCCESS" | string;

export async function createInAppNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string
) {
  try {
    return await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        link,
        read: false,
      },
    });
  } catch (error) {
    console.error("[inAppNotifications] Failed to create notification:", error);
  }
}

export async function notifyAdminAndReceptionist(
  type: NotificationType,
  title: string,
  message: string,
  link?: string
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
        createInAppNotification(user.id, type, title, message, link)
      )
    );
  } catch (error) {
    console.error("[inAppNotifications] Failed to notify staff:", error);
  }
}
