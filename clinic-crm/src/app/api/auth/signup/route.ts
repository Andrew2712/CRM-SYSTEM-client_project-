/**
 * src/app/api/auth/signup/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { rateLimitAuth, rateLimitResponse } from "@/lib/rateLimit";
import { auditLog } from "@/lib/audit";
import { requireAuth, requireRole } from "@/lib/rbac";
import type { AuthSession } from "@/lib/rbac";
import { validate, SignupSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  // ── 1. Rate limit ─────────────────────────────────────────────────────────
  const rl = await rateLimitAuth(req);
  if (!rl.success) return rateLimitResponse(rl);

  // ── 2. Auth gate — MUST be an authenticated ADMIN ────────────────────────
  let session: AuthSession;
  try {
    session = await requireAuth();
    requireRole(session, ["ADMIN"]);
  } catch (err) {
    return err as NextResponse;
  }

  // ── 3. Validate body with Zod ─────────────────────────────────────────────
  const body = await req.json();
  const result = validate(SignupSchema, body);

  // Discriminated union check — after this branch, result.data is guaranteed defined
  if (result.error !== undefined) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { name, email, password, role, phone } = result.data;

  // ── 4. Duplicate-email check ──────────────────────────────────────────────
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing)
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });

  // ── 5. Hash password and create user ─────────────────────────────────────
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role, phone: phone?.trim() },
  });

  // ── 6. Audit log ──────────────────────────────────────────────────────────
  await auditLog({
    session,
    req,
    action:      "CREATE",
    entity:      "Staff",
    entityId:    user.id,
    description: `Admin "${session.user.name}" created staff account for "${user.name}" (${user.role})`,
    newValue:    { name: user.name, email: user.email, role: user.role },
  });

  return NextResponse.json(
    { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
    { status: 201 }
  );
}