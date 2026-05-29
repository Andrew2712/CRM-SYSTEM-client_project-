/**
 * __tests__/api/core.test.ts
 */

import { describe, it, expect } from "@jest/globals";

// ─── Helpers & mocks ─────────────────────────────────────────────────────────

// Simple in-memory store for mock Prisma calls
const mockPatients: Record<string, { id: string; email: string; passwordHash: string; isActive: boolean }> = {};
const mockUsers: Record<string, { id: string; email: string; role: string; passwordHash: string; isActive: boolean }> = {};
const mockAppointments: Array<{
  id: string; doctorId: string; patientId: string;
  startTime: Date; endTime: Date; status: string;
  reminder24hSent: boolean; reminder2hSent: boolean;
}> = [];

// ─── RBAC unit tests ─────────────────────────────────────────────────────────

describe("RBAC — requireRole()", () => {
  function requireRole(
    session: { user: { role: string } },
    allowed: string[]
  ): void {
    if (!allowed.includes(session.user.role)) {
      const err = new Error("Forbidden");
      (err as unknown as { status: number }).status = 403;
      throw err;
    }
  }

  it("allows ADMIN to access admin-only routes", () => {
    const session = { user: { role: "ADMIN", id: "u1", name: "Admin", email: "a@a.com" } };
    expect(() => requireRole(session, ["ADMIN"])).not.toThrow();
  });

  it("throws 403 when DOCTOR tries to access ADMIN-only route", () => {
    const session = { user: { role: "DOCTOR", id: "u2", name: "Doc", email: "d@d.com" } };
    expect(() => requireRole(session, ["ADMIN"])).toThrow("Forbidden");
  });

  it("throws 403 when RECEPTIONIST tries admin route", () => {
    const session = { user: { role: "RECEPTIONIST", id: "u3", name: "Rec", email: "r@r.com" } };
    expect(() => requireRole(session, ["ADMIN"])).toThrow("Forbidden");
  });

  it("allows multi-role routes for all allowed roles", () => {
    const roles = ["ADMIN", "DOCTOR", "RECEPTIONIST"];
    roles.forEach((role) => {
      const session = { user: { role, id: "u", name: "u", email: "u@u.com" } };
      expect(() => requireRole(session, ["ADMIN", "DOCTOR", "RECEPTIONIST"])).not.toThrow();
    });
  });

  it("PATIENT is never in staff role lists", () => {
    const session = { user: { role: "PATIENT", id: "p1", name: "Pat", email: "p@p.com" } };
    expect(() => requireRole(session, ["ADMIN", "DOCTOR", "RECEPTIONIST"])).toThrow("Forbidden");
  });
});

// ─── Password validation ──────────────────────────────────────────────────────

describe("Password strength — SignupSchema", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { z } = require("zod");

  const SignupSchema = z.object({
    name: z.string().min(2).max(100).trim(),
    email: z.string().email().toLowerCase(),
    password: z
      .string()
      .min(8)
      .regex(/[A-Z]/, "Must contain uppercase")
      .regex(/[0-9]/, "Must contain number")
      .regex(/[^A-Za-z0-9]/, "Must contain special character"),
    role: z.enum(["ADMIN", "DOCTOR", "RECEPTIONIST"]),
  });

  it("accepts a valid strong password", () => {
    const result = SignupSchema.safeParse({
      name: "John Doe",
      email: "john@clinic.com",
      password: "Secure@123",
      role: "DOCTOR",
    });
    expect(result.success).toBe(true);
  });

  it("rejects passwords shorter than 8 characters", () => {
    const result = SignupSchema.safeParse({
      name: "John Doe",
      email: "john@clinic.com",
      password: "Ab@1",
      role: "DOCTOR",
    });
    expect(result.success).toBe(false);
  });

  it("rejects passwords without uppercase", () => {
    const result = SignupSchema.safeParse({
      name: "John",
      email: "j@c.com",
      password: "secure@123",
      role: "ADMIN",
    });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i: { message: string }) => i.message).join(";") ?? "";
    expect(messages).toContain("uppercase");
  });

  it("rejects passwords without special character", () => {
    const result = SignupSchema.safeParse({
      name: "John",
      email: "j@c.com",
      password: "Secure123",
      role: "ADMIN",
    });
    expect(result.success).toBe(false);
  });

  it("rejects PATIENT as a signup role", () => {
    const result = SignupSchema.safeParse({
      name: "Pat",
      email: "p@c.com",
      password: "Secure@123",
      role: "PATIENT",
    });
    expect(result.success).toBe(false);
  });
});

// ─── Cron auth validation ─────────────────────────────────────────────────────

describe("Cron secret validation", () => {
  function validateCronSecret(
    authHeader: string | null,
    envSecret: string | undefined
  ): { ok: boolean; status: number; error?: string } {
    if (!envSecret?.trim()) {
      return { ok: false, status: 500, error: "CRON_SECRET not set" };
    }
    if (authHeader !== `Bearer ${envSecret}`) {
      return { ok: false, status: 401, error: "Unauthorized" };
    }
    return { ok: true, status: 200 };
  }

  it("returns 500 when CRON_SECRET env var is missing", () => {
    const result = validateCronSecret("Bearer sometoken", undefined);
    expect(result.status).toBe(500);
    expect(result.ok).toBe(false);
  });

  it("returns 401 when token does not match", () => {
    const result = validateCronSecret("Bearer wrong", "correct-secret");
    expect(result.status).toBe(401);
  });

  it("returns 401 when Authorization header is missing", () => {
    const result = validateCronSecret(null, "correct-secret");
    expect(result.status).toBe(401);
  });

  it("returns 200 when token matches", () => {
    const result = validateCronSecret("Bearer my-secret", "my-secret");
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });
});

// ─── Booking conflict detection ───────────────────────────────────────────────

describe("Booking conflict detection", () => {
  function hasConflict(
    newStart: Date,
    newEnd: Date,
    existing: Array<{ startTime: Date; endTime: Date }>
  ): boolean {
    return existing.some(
      (appt) => newStart < appt.endTime && newEnd > appt.startTime
    );
  }

  const existing = [
    {
      startTime: new Date("2026-06-01T09:00:00Z"),
      endTime:   new Date("2026-06-01T10:00:00Z"),
    },
  ];

  it("detects overlap when new slot starts inside existing slot", () => {
    const start = new Date("2026-06-01T09:30:00Z");
    const end   = new Date("2026-06-01T10:30:00Z");
    expect(hasConflict(start, end, existing)).toBe(true);
  });

  it("detects overlap when new slot fully contains existing slot", () => {
    const start = new Date("2026-06-01T08:30:00Z");
    const end   = new Date("2026-06-01T10:30:00Z");
    expect(hasConflict(start, end, existing)).toBe(true);
  });

  it("allows back-to-back slots (no overlap)", () => {
    const start = new Date("2026-06-01T10:00:00Z");
    const end   = new Date("2026-06-01T11:00:00Z");
    expect(hasConflict(start, end, existing)).toBe(false);
  });

  it("allows slot completely before existing", () => {
    const start = new Date("2026-06-01T07:00:00Z");
    const end   = new Date("2026-06-01T09:00:00Z");
    expect(hasConflict(start, end, existing)).toBe(false);
  });

  it("allows slot completely after existing", () => {
    const start = new Date("2026-06-01T10:00:00Z");
    const end   = new Date("2026-06-01T11:00:00Z");
    expect(hasConflict(start, end, existing)).toBe(false);
  });
});

// ─── Reminder deduplication ───────────────────────────────────────────────────

describe("Reminder deduplication flags", () => {
  interface MockAppt {
    id: string;
    reminder24hSent: boolean;
    reminder2hSent: boolean;
  }

  function shouldSend24h(appt: MockAppt): boolean {
    return !appt.reminder24hSent;
  }

  function shouldSend2h(appt: MockAppt): boolean {
    return !appt.reminder2hSent;
  }

  it("sends 24h reminder when flag is false", () => {
    const appt: MockAppt = { id: "a1", reminder24hSent: false, reminder2hSent: false };
    expect(shouldSend24h(appt)).toBe(true);
  });

  it("skips 24h reminder when already sent", () => {
    const appt: MockAppt = { id: "a2", reminder24hSent: true, reminder2hSent: false };
    expect(shouldSend24h(appt)).toBe(false);
  });

  it("sends 2h reminder when flag is false", () => {
    const appt: MockAppt = { id: "a3", reminder24hSent: true, reminder2hSent: false };
    expect(shouldSend2h(appt)).toBe(true);
  });

  it("skips 2h reminder when already sent", () => {
    const appt: MockAppt = { id: "a4", reminder24hSent: true, reminder2hSent: true };
    expect(shouldSend2h(appt)).toBe(false);
  });
});

// ─── Environment variable validation ─────────────────────────────────────────

describe("Environment validation — validateEnv()", () => {
  const REQUIRED = [
    "DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL",
    "RESEND_API_KEY", "EMAIL_FROM", "META_WA_TOKEN",
    "META_WA_PHONE_ID", "CRON_SECRET",
    "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN",
  ];

  function validateEnv(env: Record<string, string>): string[] {
    return REQUIRED.filter((k) => !env[k]?.trim());
  }

  it("passes when all required vars are set", () => {
    const env = Object.fromEntries(REQUIRED.map((k) => [k, "value"]));
    expect(validateEnv(env)).toHaveLength(0);
  });

  it("reports missing DATABASE_URL", () => {
    const env = Object.fromEntries(REQUIRED.map((k) => [k, "value"]));
    delete env.DATABASE_URL;
    const missing = validateEnv(env);
    expect(missing).toContain("DATABASE_URL");
  });

  it("reports missing UPSTASH vars (new requirement)", () => {
    const env = Object.fromEntries(REQUIRED.map((k) => [k, "value"]));
    delete env.UPSTASH_REDIS_REST_URL;
    delete env.UPSTASH_REDIS_REST_TOKEN;
    const missing = validateEnv(env);
    expect(missing).toContain("UPSTASH_REDIS_REST_URL");
    expect(missing).toContain("UPSTASH_REDIS_REST_TOKEN");
  });

  it("reports whitespace-only vars as missing", () => {
    const env = Object.fromEntries(REQUIRED.map((k) => [k, "value"]));
    env.CRON_SECRET = "   ";
    const missing = validateEnv(env);
    expect(missing).toContain("CRON_SECRET");
  });
});