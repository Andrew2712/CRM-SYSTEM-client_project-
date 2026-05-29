/**
 * lib/patientActivity.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Computes patient activity dynamically (never stored in DB).
 */

import { prisma } from "@/lib/prisma";
import type { Prisma, PatientStatus } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// ✅ Types
// ─────────────────────────────────────────────────────────────────────────────

export type ActivityStatus = "ACTIVE" | "INACTIVE";

export type PatientWithActivity = Awaited<
  ReturnType<typeof fetchPatientsWithActivity>
>[number];

// ─────────────────────────────────────────────────────────────────────────────
// ✅ Config
// ─────────────────────────────────────────────────────────────────────────────

const ACTIVITY_WINDOW_DAYS = 3;

// ─────────────────────────────────────────────────────────────────────────────
// ✅ Compute Activity Status
// ─────────────────────────────────────────────────────────────────────────────

export function computeActivityStatus(
  lastAttendedAt: Date | null | undefined
): ActivityStatus {
  if (!lastAttendedAt) return "INACTIVE";

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ACTIVITY_WINDOW_DAYS);
  cutoff.setHours(0, 0, 0, 0);

  return lastAttendedAt >= cutoff ? "ACTIVE" : "INACTIVE";
}

// ─────────────────────────────────────────────────────────────────────────────
// ✅ Prisma Include (Reusable)
// ─────────────────────────────────────────────────────────────────────────────

export const activityInclude = {
  appointments: {
    where: { status: "ATTENDED" as const },
    orderBy: { startTime: "desc" as const },
    take: 1,
    select: { startTime: true },
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// ✅ Enrich Patients (Pure Function)
// ─────────────────────────────────────────────────────────────────────────────

export function enrichWithActivity<
  T extends { appointments: Array<{ startTime: Date }> }
>(
  patients: T[]
): Array<
  Omit<T, "appointments"> & {
    lastAttendedAt: Date | null;
    activityStatus: ActivityStatus;
  }
> {
  return patients.map((patient) => {
    const lastAttendedAt = patient.appointments?.[0]?.startTime ?? null;

    return {
      ...patient,
      // ❗ optional: hide raw appointments from API response
      // appointments: undefined,
      lastAttendedAt,
      activityStatus: computeActivityStatus(lastAttendedAt),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ✅ Fetch Patients with Activity (MAIN FUNCTION)
// ─────────────────────────────────────────────────────────────────────────────

// Add isActive: true to the base where clause
export async function fetchPatientsWithActivity(options?: {
  where?: Prisma.PatientWhereInput;
  searchTerm?: string;
  statusFilter?: string;
}) {
  const { where = {}, searchTerm = "", statusFilter = "" } = options ?? {};

  const patients = await prisma.patient.findMany({
    where: {
      isActive: true,          // ← ADD THIS
      ...where,
      ...(searchTerm ? {
        OR: [
          { name: { contains: searchTerm, mode: "insensitive" } },
          { phone: { contains: searchTerm } },
          { patientCode: { contains: searchTerm, mode: "insensitive" } },
        ],
      } : {}),
      ...(statusFilter ? { status: statusFilter as PatientStatus } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      ...activityInclude,
      _count: { select: { appointments: true } },
    },
  });

  return enrichWithActivity(patients);
}