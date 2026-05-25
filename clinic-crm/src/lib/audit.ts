/**
 * src/lib/audit.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Audit logging helpers.
 *
 * Every CREATE / UPDATE / DELETE / sensitive action writes a row to AuditLog.
 * Logs are fire-and-forget — they never block the main response.
 *
 * Usage:
 *   await auditLog({
 *     session,
 *     req,
 *     action:      "UPDATE",
 *     entity:      "Appointment",
 *     entityId:    id,
 *     description: `Status changed to ATTENDED`,
 *     oldValue:    { status: "CONFIRMED" },
 *     newValue:    { status: "ATTENDED" },
 *   });
 *
 * Helper wrappers per entity type are at the bottom.
 */

import { prisma }      from "@/lib/prisma";
import { Prisma }      from "@prisma/client";
import { getClientIp } from "@/lib/rateLimit";
import type { AuditAction } from "@prisma/client";
import type { AuthSession }  from "@/lib/rbac";
import type { NextRequest }  from "next/server";

// ─── Core ─────────────────────────────────────────────────────────────────────

type AuditParams = {
  session:     AuthSession;
  req?:        NextRequest;
  action:      AuditAction;
  entity:      string;
  entityId:    string;
  description: string;
  oldValue?:   Record<string, unknown> | null;
  newValue?:   Record<string, unknown> | null;
};

export async function auditLog(params: AuditParams): Promise<void> {
  const { session, req, action, entity, entityId, description, oldValue, newValue } = params;

  try {
    await prisma.auditLog.create({
      data: {
        userId:      session.user.id,
        userName:    session.user.name,
        userRole:    session.user.role,
        action,
        entity,
        entityId,
        description,
        oldValue:    oldValue != null ? oldValue as Prisma.InputJsonValue : undefined,
        newValue:    newValue != null ? newValue as Prisma.InputJsonValue : undefined,
        ipAddress:   req ? getClientIp(req) : undefined,
        userAgent:   req?.headers.get("user-agent") ?? undefined,
      },
    });
  } catch (err) {
    // Never crash the main request because of audit failure
    console.error("[AuditLog] Failed to write audit entry:", err);
  }
}

// ─── Entity-specific helpers ──────────────────────────────────────────────────

export async function auditExpense(
  session: AuthSession,
  req: NextRequest,
  action: "CREATE" | "UPDATE" | "DELETE",
  expenseId: string,
  details: { title: string; amount?: number; old?: Record<string, unknown>; new?: Record<string, unknown> }
) {
  const messages: Record<string, string> = {
    CREATE: `Created expense "${details.title}" — ₹${details.amount ?? 0}`,
    UPDATE: `Updated expense "${details.title}"`,
    DELETE: `Deleted expense "${details.title}"`,
  };
  await auditLog({
    session, req,
    action:      action as AuditAction,
    entity:      "Expense",
    entityId:    expenseId,
    description: messages[action],
    oldValue:    details.old,
    newValue:    details.new,
  });
}

export async function auditAppointment(
  session: AuthSession,
  req: NextRequest,
  action: "CREATE" | "UPDATE" | "DELETE",
  appointmentId: string,
  details: { patientName?: string; status?: string; old?: Record<string, unknown>; new?: Record<string, unknown> }
) {
  const messages: Record<string, string> = {
    CREATE: `Booked appointment for ${details.patientName ?? "patient"}`,
    UPDATE: `Updated appointment${details.status ? ` → ${details.status}` : ""}`,
    DELETE: `Cancelled appointment for ${details.patientName ?? "patient"}`,
  };
  await auditLog({
    session, req,
    action:      action as AuditAction,
    entity:      "Appointment",
    entityId:    appointmentId,
    description: messages[action],
    oldValue:    details.old,
    newValue:    details.new,
  });
}

export async function auditPatient(
  session: AuthSession,
  req: NextRequest,
  action: "CREATE" | "UPDATE" | "DELETE",
  patientId: string,
  details: { name: string; old?: Record<string, unknown>; new?: Record<string, unknown> }
) {
  const messages: Record<string, string> = {
    CREATE: `Registered new patient "${details.name}"`,
    UPDATE: `Updated patient record for "${details.name}"`,
    DELETE: `Deactivated patient "${details.name}"`,
  };
  await auditLog({
    session, req,
    action:      action as AuditAction,
    entity:      "Patient",
    entityId:    patientId,
    description: messages[action],
    oldValue:    details.old,
    newValue:    details.new,
  });
}

export async function auditStaff(
  session: AuthSession,
  req: NextRequest,
  action: "CREATE" | "UPDATE" | "DELETE" | "PASSWORD_RESET" | "ROLE_CHANGE",
  staffId: string,
  details: { name: string; old?: Record<string, unknown>; new?: Record<string, unknown> }
) {
  const messages: Record<string, string> = {
    CREATE:         `Created staff account for "${details.name}"`,
    UPDATE:         `Updated staff profile for "${details.name}"`,
    DELETE:         `Deactivated staff account for "${details.name}"`,
    PASSWORD_RESET: `Reset password for "${details.name}"`,
    ROLE_CHANGE:    `Changed role for "${details.name}"`,
  };
  await auditLog({
    session, req,
    action:      action as AuditAction,
    entity:      "Staff",
    entityId:    staffId,
    description: messages[action],
    oldValue:    details.old,
    newValue:    details.new,
  });
}

export async function auditExport(
  session: AuthSession,
  req: NextRequest,
  entity: string,
  details: { count: number; filters?: Record<string, unknown> }
) {
  await auditLog({
    session, req,
    action:      "EXPORT",
    entity,
    entityId:    "bulk",
    description: `Exported ${details.count} ${entity} records`,
    newValue:    details.filters,
  });
}