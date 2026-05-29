/**
 * src/lib/timezone.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Timezone helpers — converts UTC DateTime to IST (Asia/Kolkata, UTC+5:30)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 5h 30m in milliseconds

/**
 * Convert a UTC Date to a human-readable IST string.
 * e.g. "Mon, 28 Apr 2025, 10:30 AM IST"
 */
export function toIST(utcDate: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(utcDate) + " IST";
}

/**
 * Calculate the difference in hours between now (UTC) and a future UTC date.
 * Returns a positive number if the event is in the future.
 */
export function hoursUntil(utcDate: Date): number {
  const nowMs = Date.now();
  const targetMs = utcDate.getTime();
  return (targetMs - nowMs) / (1000 * 60 * 60);
}