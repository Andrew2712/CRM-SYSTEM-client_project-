/**
 * src/lib/notifications.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Deduplication + recording of notifications.
 *
 * DESIGN:
 *   - `scheduledAt` stores a sentinel date (used ONLY for dedup lookup)
 *   - `sentAt`      stores the REAL timestamp when the notification fired
 *   - The UI should display `sentAt` — NOT `scheduledAt`
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { prisma } from "@/lib/prisma";
import { NotificationChannel, NotificationStatus } from "@prisma/client";

// Sentinel dates — used ONLY as unique dedup keys, never displayed in UI
export const NOTIF_SENTINEL = {
  BOOKING_PATIENT_EMAIL: new Date("2000-01-01T00:00:00Z"),
  BOOKING_PATIENT_WA:    new Date("2000-01-01T00:01:00Z"),
  BOOKING_DOCTOR_EMAIL:  new Date("2000-01-01T00:02:00Z"),
  BOOKING_DOCTOR_WA:     new Date("2000-01-01T00:03:00Z"),
  REMINDER_24H_WA:       new Date("2000-01-01T01:00:00Z"),
  REMINDER_2H_WA:        new Date("2000-01-01T02:00:00Z"),
  MISSED_PATIENT_WA:     new Date("2000-01-01T03:00:00Z"),
  MISSED_DOCTOR_EMAIL:   new Date("2000-01-01T03:01:00Z"),
} as const;

// Human-readable label for each notification type — used in UI
export const NOTIF_LABEL: Record<keyof typeof NOTIF_SENTINEL, string> = {
  BOOKING_PATIENT_EMAIL: "Booking Confirmed (Email → Patient)",
  BOOKING_PATIENT_WA:    "Booking Confirmed (WhatsApp → Patient)",
  BOOKING_DOCTOR_EMAIL:  "Booking Confirmed (Email → Doctor)",
  BOOKING_DOCTOR_WA:     "Booking Confirmed (WhatsApp → Doctor)",
  REMINDER_24H_WA:       "24h Reminder (WhatsApp → Patient)",
  REMINDER_2H_WA:        "2h Reminder (WhatsApp → Patient)",
  MISSED_PATIENT_WA:     "Missed Session (WhatsApp → Patient)",
  MISSED_DOCTOR_EMAIL:   "Missed Session (Email → Doctor)",
};

export type SentinelKey = keyof typeof NOTIF_SENTINEL;

/** Returns true if already SENT — checks by sentinel (dedup key) */
export async function alreadySent(
  appointmentId: string,
  key: SentinelKey
): Promise<boolean> {
  const existing = await prisma.notification.findFirst({
    where: {
      appointmentId,
      channel: channelForKey(key),
      scheduledAt: NOTIF_SENTINEL[key],
      status: NotificationStatus.SENT,
    },
  });
  return existing !== null;
}

/**
 * Record a notification as SENT.
 * - scheduledAt = sentinel (dedup key, never changes)
 * - sentAt      = NOW (real trigger time — shown in UI)
 */
export async function recordSent(
  appointmentId: string,
  key: SentinelKey
): Promise<void> {
  const now = new Date(); // ← real trigger timestamp

  const existing = await prisma.notification.findFirst({
    where: {
      appointmentId,
      channel: channelForKey(key),
      scheduledAt: NOTIF_SENTINEL[key],
    },
  });

  if (!existing) {
    await prisma.notification.create({
      data: {
        appointmentId,
        channel: channelForKey(key),
        scheduledAt: NOTIF_SENTINEL[key], // dedup key — never displayed
        sentAt: now,                       // real time — shown in UI
        status: NotificationStatus.SENT,
      },
    });
  } else {
    await prisma.notification.update({
      where: { id: existing.id },
      data: {
        sentAt: now,
        status: NotificationStatus.SENT,
      },
    });
  }
}

/** Record a notification as FAILED */
export async function recordFailed(
  appointmentId: string,
  key: SentinelKey
): Promise<void> {
  const existing = await prisma.notification.findFirst({
    where: {
      appointmentId,
      channel: channelForKey(key),
      scheduledAt: NOTIF_SENTINEL[key],
    },
  });

  if (!existing) {
    await prisma.notification.create({
      data: {
        appointmentId,
        channel: channelForKey(key),
        scheduledAt: NOTIF_SENTINEL[key],
        sentAt: null,
        status: NotificationStatus.FAILED,
      },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function channelForKey(key: SentinelKey): NotificationChannel {
  if (key.endsWith("_WA")) return NotificationChannel.WHATSAPP;
  return NotificationChannel.EMAIL;
}

/** Returns the human-readable label for a sentinel date — for UI display */
export function labelForSentinel(scheduledAt: Date): string {
  const ts = scheduledAt.getTime();
  for (const [key, sentinel] of Object.entries(NOTIF_SENTINEL)) {
    if (sentinel.getTime() === ts) {
      return NOTIF_LABEL[key as SentinelKey];
    }
  }
  return "Notification";
}