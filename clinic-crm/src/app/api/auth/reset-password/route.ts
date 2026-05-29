/**
 * src/app/api/auth/reset-password/route.ts
 * Admin-initiated password reset for staff and patients.
 *
 * PRODUCTION FIX: The original route read body.email and body.newPassword
 * with a manual `if (!email || !newPassword)` check, skipping the shared
 * Zod validation used everywhere else. This adds proper schema validation
 * with the same password-strength rules applied on signup.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireAuth, requireRole } from "@/lib/rbac";
import { rateLimitAuth, rateLimitResponse } from "@/lib/rateLimit";
import { auditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";

// ── Validation schema ─────────────────────────────────────────────────────────
const AdminResetPasswordSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase(),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Must contain at least one special character"),
});

export async function POST(req: NextRequest) {
  // ── Rate limit ─────────────────────────────────────────────────────────────
  const rl = await rateLimitAuth(req);
  if (!rl.success) return rateLimitResponse(rl);

  // ── Auth gate ──────────────────────────────────────────────────────────────
  let session;
  try {
    session = await requireAuth();
    requireRole(session, ["ADMIN"]);
  } catch (err) {
    return err as NextResponse;
  }

  // ── Zod validation ─────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = AdminResetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((e) => e.message).join("; ");
    return NextResponse.json({ error: messages }, { status: 400 });
  }

  const { email, newPassword } = parsed.data;

  const passwordHash = await bcrypt.hash(newPassword, 10);

  // Try staff first
  const staffUser = await prisma.user.findUnique({ where: { email } });
  if (staffUser) {
    await prisma.user.update({ where: { email }, data: { passwordHash } });
    await auditLog({
      session, req,
      action:      "PASSWORD_RESET",
      entity:      "Staff",
      entityId:    staffUser.id,
      description: `Admin reset password for staff "${staffUser.name}"`,
    });
    logger.info("[ResetPassword] Staff password reset", { staffId: staffUser.id });
    return NextResponse.json({ success: true, type: "staff" });
  }

  // Try patient
  const patient = await prisma.patient.findFirst({ where: { email } });
  if (patient) {
    await prisma.patient.update({ where: { id: patient.id }, data: { passwordHash } });
    await auditLog({
      session, req,
      action:      "PASSWORD_RESET",
      entity:      "Patient",
      entityId:    patient.id,
      description: `Admin reset password for patient "${patient.name}"`,
    });
    logger.info("[ResetPassword] Patient password reset", { patientId: patient.id });
    return NextResponse.json({ success: true, type: "patient" });
  }

  return NextResponse.json(
    { error: "No account found with this email" },
    { status: 404 }
  );
}
