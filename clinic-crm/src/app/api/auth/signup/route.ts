import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, password, role, phone } = body;

  // ── Required field validation ─────────────────────────────────────────────
  if (!name || !email || !password || !role) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  if (!phone || phone.trim() === "") {
    return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
  }

  if (!/^\+?[\d\s\-().]{7,20}$/.test(phone.trim())) {
    return NextResponse.json({ error: "Invalid phone number format" }, { status: 400 });
  }

  if (!["DOCTOR", "ADMIN", "RECEPTIONIST"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // ── Duplicate check ───────────────────────────────────────────────────────
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  // ── Create user (password hashing unchanged) ──────────────────────────────
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
      phone: phone.trim(),
    },
  });

  return NextResponse.json({
    id:    user.id,
    name:  user.name,
    email: user.email,
    role:  user.role,
    phone: user.phone,
  });
}
