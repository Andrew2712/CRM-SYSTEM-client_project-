/**
 * src/app/api/auth/reset-password/route.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * POST /api/auth/reset-password
 *
 * Supports password reset for both staff (User) and patients (Patient).
 * IMPORTANT: This is an admin-initiated reset. The patient-self-service
 * change-password is at /api/patients/change-password.
 *
 * Body: { email: string; newPassword: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireAuth, requireRole } from "@/lib/rbac";

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireAuth();
    requireRole(session, ["ADMIN"]);
  } catch (err) {
    return err as NextResponse;
  }

  const body = await req.json();
  const { email, newPassword } = body;

  if (!email || !newPassword) {
    return NextResponse.json(
      { error: "Email and new password are required" },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  // Try staff first
  const staffUser = await prisma.user.findUnique({ where: { email } });
  if (staffUser) {
    await prisma.user.update({ where: { email }, data: { passwordHash } });
    return NextResponse.json({ success: true, type: "staff" });
  }

  // Try patient
  const patient = await prisma.patient.findFirst({ where: { email } });
  if (patient) {
    await prisma.patient.update({ where: { id: patient.id }, data: { passwordHash } });
    return NextResponse.json({ success: true, type: "patient" });
  }

  return NextResponse.json(
    { error: "No account found with this email" },
    { status: 404 }
  );
}
