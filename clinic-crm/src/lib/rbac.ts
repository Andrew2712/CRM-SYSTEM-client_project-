/**
 * lib/rbac.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Role-Based Access Control helpers for the Clinic CRM.
 *
 * Usage pattern (in every API route):
 *   const session = await requireAuth();              // throws → 401
 *   const filter  = getAppointmentFilter(session);    // scopes the query
 *   await assertCanAccessAppointment(id, session);    // throws → 403
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthSession = Awaited<ReturnType<typeof getServerSession>> & {
  user: { id: string; role: "ADMIN" | "DOCTOR" | "RECEPTIONIST"; name: string; email: string };
};

// ─── requireAuth ─────────────────────────────────────────────────────────────
/**
 * Asserts the request is authenticated.
 * Returns the typed session or throws a NextResponse (401).
 *
 * Usage:
 *   const session = await requireAuth();
 */
export async function requireAuth(): Promise<AuthSession> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session as AuthSession;
}

// ─── requireRole ─────────────────────────────────────────────────────────────
/**
 * Asserts the session user has one of the allowed roles.
 * Throws a NextResponse (403) if not.
 *
 * Usage:
 *   requireRole(session, ["ADMIN"]);
 */
export function requireRole(
  session: AuthSession,
  allowedRoles: Array<"ADMIN" | "DOCTOR" | "RECEPTIONIST">
): void {
  if (!allowedRoles.includes(session.user.role)) {
    throw NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

// ─── getAppointmentFilter ─────────────────────────────────────────────────────
/**
 * Returns a Prisma `where` fragment that scopes appointments to what the
 * current user is allowed to see.
 *
 *   ADMIN / RECEPTIONIST → no extra filter (sees all)
 *   DOCTOR               → { doctorId: session.user.id }
 *
 * Merge this into every appointment query:
 *   prisma.appointment.findMany({ where: { ...getAppointmentFilter(session), ...yourOtherFilters } })
 */
export function getAppointmentFilter(
  session: AuthSession
): Prisma.AppointmentWhereInput {
  if (session.user.role === "DOCTOR") {
    return { doctorId: session.user.id };
  }
  // ADMIN and RECEPTIONIST see everything
  return {};
}

// ─── assertCanAccessAppointment ───────────────────────────────────────────────
/**
 * Checks that the requesting user is allowed to read/mutate a specific
 * appointment. Throws 403 if a DOCTOR tries to touch another doctor's record.
 *
 * Usage:
 *   await assertCanAccessAppointment(appointmentId, session);
 */
export async function assertCanAccessAppointment(
  appointmentId: string,
  session: AuthSession
): Promise<void> {
  if (session.user.role !== "DOCTOR") return; // ADMIN / RECEPTIONIST: allowed

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { doctorId: true },
  });

  if (!appt) {
    throw NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  if (appt.doctorId !== session.user.id) {
    throw NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

// ─── getPatientFilter ─────────────────────────────────────────────────────────
/**
 * For DOCTORs, limits patient results to patients who have at least one
 * appointment with that doctor (avoids leaking other doctors' patients).
 *
 * ADMIN / RECEPTIONIST → no filter.
 */
export function getPatientFilter(
  session: AuthSession
): Prisma.PatientWhereInput {
  if (session.user.role === "DOCTOR") {
    return {
      appointments: {
        some: { doctorId: session.user.id },
      },
    };
  }
  return {};
}