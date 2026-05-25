/**
 * src/lib/bookingConflict.ts
 *
 * Reusable overlap-detection helper for the booking engine.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The old code did:
 *   findFirst({ where: { doctorId, startTime: start, status: { in: [...] } } })
 *
 * That only catches an EXACT start-time match. Two sessions can still overlap:
 *   Patient A  10:00 – 11:00
 *   Patient B  10:30 – 11:30  ← different startTime, but overlaps!
 *
 * The correct guard is: no active appointment for this doctor whose window
 * intersects [newStart, newEnd).
 *
 * Two intervals [a,b) and [c,d) overlap when: a < d AND c < b
 * → Prisma translation: startTime < newEnd AND endTime > newStart
 *
 * STATUSES THAT BLOCK A SLOT
 * ───────────────────────────
 * CONFIRMED and RESCHEDULED are "live" bookings that occupy the slot.
 * ATTENDED, MISSED, CANCELLED are resolved — their slot is free again.
 *
 * USAGE INSIDE A TRANSACTION
 * ───────────────────────────
 * Always call this with the transactional Prisma client (tx), never with the
 * global singleton. That is what makes it race-condition safe: the SELECT and
 * the INSERT share the same serialisable transaction snapshot.
 */

import { Prisma, PrismaClient } from "@prisma/client";

// The subset of statuses that "hold" a slot
export const BLOCKING_STATUSES = ["CONFIRMED", "RESCHEDULED"] as const;

export interface ConflictCheckParams {
  doctorId: string;
  newStartTime: Date;
  newEndTime: Date;
  /** Pass the appointment id to EXCLUDE when checking reschedules. */
  excludeAppointmentId?: string;
}

/**
 * Returns the conflicting appointment (id + times) if one exists, or null.
 *
 * @param tx   - The Prisma transactional client (from prisma.$transaction callback).
 * @param params - Slot details to check.
 */
export async function findOverlappingAppointment(
  tx: Omit<
    PrismaClient,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
  >,
  params: ConflictCheckParams
) {
  const { doctorId, newStartTime, newEndTime, excludeAppointmentId } = params;

  const conflict = await tx.appointment.findFirst({
    where: {
      doctorId,
      status: { in: [...BLOCKING_STATUSES] },
      // Overlap condition: existing.startTime < newEnd AND existing.endTime > newStart
      AND: [
        { startTime: { lt: newEndTime } },
        { endTime:   { gt: newStartTime } },
      ],
      // When rescheduling, exclude the appointment being moved
      ...(excludeAppointmentId ? { NOT: { id: excludeAppointmentId } } : {}),
    },
    select: { id: true, startTime: true, endTime: true, status: true },
  });

  return conflict ?? null;
}
