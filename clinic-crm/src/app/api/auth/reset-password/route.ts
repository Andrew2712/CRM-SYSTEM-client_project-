/**
 * POST /api/auth/reset-password
 * Admin-initiated password reset for staff and patients.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireAuth, requireRole } from "@/lib/rbac";
import { rateLimitAuth, rateLimitResponse } from "@/lib/rateLimit";
import { auditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  // ── Rate limit: 5 resets / 60s per IP (brute-force protection) ───────────
  const rl = await rateLimitAuth(req);
  if (!rl.success) return rateLimitResponse(rl);

  let session;
  try {
    session = await requireAuth();
    requireRole(session, ["ADMIN"]);
  } catch (err) {
    return err as NextResponse;
  }

  const body = await req.json();
  const { email, newPassword } = body;

  if (!email || !newPassword)
    return NextResponse.json({ error: "Email and new password are required" }, { status: 400 });

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
      description: `Admin reset password for staff "${staffUser.name}" (${staffUser.email})`,
    });
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
      description: `Admin reset password for patient "${patient.name}" (${patient.email})`,
    });
    return NextResponse.json({ success: true, type: "patient" });
  }

  return NextResponse.json({ error: "No account found with this email" }, { status: 404 });
}
