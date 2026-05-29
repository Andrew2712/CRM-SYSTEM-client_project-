import { prisma } from "@/lib/prisma";

export async function createInAppNotification({
  userId,
  title,
  message,
  type = "INFO",
  link,
}: {
  userId: string;
  title: string;
  message: string;
  type?: "INFO" | "WARNING" | "ERROR" | "SUCCESS";
  link?: string;
}) {
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

export async function notifyAdminAndReceptionist({
  title,
  message,
  type = "INFO",
  link,
}: {
  title: string;
  message: string;
  type?: "INFO" | "WARNING" | "ERROR" | "SUCCESS";
  link?: string;
}) {
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
        createInAppNotification({ userId: user.id, title, message, type, link })
      )
    );
  } catch (error) {
    console.error("[inAppNotifications] Failed to notify staff:", error);
  }
}
