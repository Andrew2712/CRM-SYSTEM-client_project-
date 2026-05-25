import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { rateLimitAuth, rateLimitResponse } from "@/lib/rateLimit";
import { auditLog } from "@/lib/audit";
import { requireAuth } from "@/lib/rbac";
import type { AuthSession } from "@/lib/rbac";

export async function POST(req: NextRequest) {
  // ── Rate limit: 5 signup attempts / 60s per IP ──────────────────────────
  const rl = await rateLimitAuth(req);
  if (!rl.success) return rateLimitResponse(rl);

  const body = await req.json();
  const { name, email, password, role, phone } = body;

  if (!name || !email || !password || !role)
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });

  if (!phone || phone.trim() === "")
    return NextResponse.json({ error: "Phone number is required" }, { status: 400 });

  if (!/^\+?[\d\s\-().]{7,20}$/.test(phone.trim()))
    return NextResponse.json({ error: "Invalid phone number format" }, { status: 400 });

  if (!["DOCTOR", "ADMIN", "RECEPTIONIST"].includes(role))
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing)
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role, phone: phone.trim() },
  });

  // ── Audit log (try to get the creator's session for attribution) ─────────
  try {
    const session = await requireAuth() as AuthSession;
    await auditLog({
      session,
      req,
      action:      "CREATE",
      entity:      "Staff",
      entityId:    user.id,
      description: `Created staff account for "${user.name}" (${user.role})`,
      newValue:    { name: user.name, email: user.email, role: user.role },
    });
  } catch {
    // Signup may be called without a session (self-registration) — skip audit
  }

  return NextResponse.json({
    id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone,
  });
}
