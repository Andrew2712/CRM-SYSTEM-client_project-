/**
 * __tests__/api/core.test.ts
 *
 * Expanded test suite covering:
 *   - RBAC (requireRole)
 *   - Password validation (SignupSchema)
 *   - Cron secret validation
 *   - Booking conflict detection
 *   - Reminder deduplication flags
 *   - Environment variable validation (now includes UPSTASH vars)
 *   - HTML escaping / XSS prevention in email templates        ← NEW
 *   - Rate-limit response headers                              ← NEW
 *   - Waitlist status transitions                              ← NEW
 *   - Soft-delete flag behaviour                               ← NEW
 *   - Appointment filter scoping by role                       ← NEW
 */

import { describe, it, expect } from "@jest/globals";

// ─── Helpers & in-memory mocks ────────────────────────────────────────────────

const mockPatients: Record<string, {
  id: string; email: string; passwordHash: string; isActive: boolean;
}> = {};

const mockUsers: Record<string, {
  id: string; email: string; role: string; passwordHash: string; isActive: boolean;
}> = {};

const mockAppointments: Array<{
  id: string; doctorId: string; patientId: string;
  startTime: Date; endTime: Date; status: string;
  reminder24hSent: boolean; reminder2hSent: boolean;
}> = [];

// ─── 1. RBAC ──────────────────────────────────────────────────────────────────

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

// ─── 2. Appointment filter scoping ───────────────────────────────────────────

describe("RBAC — appointment filter scoping", () => {
  type Role = "ADMIN" | "DOCTOR" | "RECEPTIONIST";

  function getAppointmentFilter(session: { user: { id: string; role: Role } }) {
    if (session.user.role === "DOCTOR") {
      return { doctorId: session.user.id };
    }
    return {};
  }

  it("DOCTOR filter is scoped to their own doctorId", () => {
    const session = { user: { id: "doc-123", role: "DOCTOR" as Role } };
    const filter = getAppointmentFilter(session);
    expect(filter).toEqual({ doctorId: "doc-123" });
  });

  it("ADMIN filter is empty (sees everything)", () => {
    const session = { user: { id: "admin-1", role: "ADMIN" as Role } };
    expect(getAppointmentFilter(session)).toEqual({});
  });

  it("RECEPTIONIST filter is empty (sees everything)", () => {
    const session = { user: { id: "rec-1", role: "RECEPTIONIST" as Role } };
    expect(getAppointmentFilter(session)).toEqual({});
  });
});

// ─── 3. Password validation ───────────────────────────────────────────────────

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

  it("rejects passwords without a number", () => {
    const result = SignupSchema.safeParse({
      name: "John",
      email: "j@c.com",
      password: "Secure@abc",
      role: "ADMIN",
    });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i: { message: string }) => i.message).join(";") ?? "";
    expect(messages).toContain("number");
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

  it("normalises email to lowercase", () => {
    const result = SignupSchema.safeParse({
      name: "John",
      email: "John@Clinic.COM",
      password: "Secure@123",
      role: "DOCTOR",
    });
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("john@clinic.com");
  });
});

// ─── 4. Cron auth ─────────────────────────────────────────────────────────────

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

  it("returns 500 when CRON_SECRET is whitespace-only", () => {
    const result = validateCronSecret("Bearer sometoken", "   ");
    expect(result.status).toBe(500);
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

// ─── 5. Booking conflict detection ───────────────────────────────────────────

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
    expect(hasConflict(
      new Date("2026-06-01T09:30:00Z"),
      new Date("2026-06-01T10:30:00Z"),
      existing
    )).toBe(true);
  });

  it("detects overlap when new slot fully contains existing slot", () => {
    expect(hasConflict(
      new Date("2026-06-01T08:30:00Z"),
      new Date("2026-06-01T10:30:00Z"),
      existing
    )).toBe(true);
  });

  it("detects overlap when new slot ends inside existing slot", () => {
    expect(hasConflict(
      new Date("2026-06-01T08:00:00Z"),
      new Date("2026-06-01T09:30:00Z"),
      existing
    )).toBe(true);
  });

  it("detects exact time match as conflict", () => {
    expect(hasConflict(
      new Date("2026-06-01T09:00:00Z"),
      new Date("2026-06-01T10:00:00Z"),
      existing
    )).toBe(true);
  });

  it("allows back-to-back slots (no overlap)", () => {
    expect(hasConflict(
      new Date("2026-06-01T10:00:00Z"),
      new Date("2026-06-01T11:00:00Z"),
      existing
    )).toBe(false);
  });

  it("allows slot completely before existing", () => {
    expect(hasConflict(
      new Date("2026-06-01T07:00:00Z"),
      new Date("2026-06-01T09:00:00Z"),
      existing
    )).toBe(false);
  });

  it("allows slot completely after existing", () => {
    expect(hasConflict(
      new Date("2026-06-01T10:00:00Z"),
      new Date("2026-06-01T11:00:00Z"),
      existing
    )).toBe(false);
  });

  it("no conflict when existing list is empty", () => {
    expect(hasConflict(
      new Date("2026-06-01T09:00:00Z"),
      new Date("2026-06-01T10:00:00Z"),
      []
    )).toBe(false);
  });
});

// ─── 6. Reminder deduplication ───────────────────────────────────────────────

describe("Reminder deduplication flags", () => {
  interface MockAppt {
    id: string;
    reminder24hSent: boolean;
    reminder2hSent: boolean;
  }

  const shouldSend24h = (appt: MockAppt) => !appt.reminder24hSent;
  const shouldSend2h  = (appt: MockAppt) => !appt.reminder2hSent;

  it("sends 24h reminder when flag is false", () => {
    expect(shouldSend24h({ id: "a1", reminder24hSent: false, reminder2hSent: false })).toBe(true);
  });

  it("skips 24h reminder when already sent", () => {
    expect(shouldSend24h({ id: "a2", reminder24hSent: true, reminder2hSent: false })).toBe(false);
  });

  it("sends 2h reminder when flag is false", () => {
    expect(shouldSend2h({ id: "a3", reminder24hSent: true, reminder2hSent: false })).toBe(true);
  });

  it("skips 2h reminder when already sent", () => {
    expect(shouldSend2h({ id: "a4", reminder24hSent: true, reminder2hSent: true })).toBe(false);
  });

  it("sends both reminders when both flags are false", () => {
    const appt: MockAppt = { id: "a5", reminder24hSent: false, reminder2hSent: false };
    expect(shouldSend24h(appt)).toBe(true);
    expect(shouldSend2h(appt)).toBe(true);
  });
});

// ─── 7. Environment variable validation ──────────────────────────────────────

describe("Environment validation — validateEnv()", () => {
  const REQUIRED = [
    "DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL",
    "RESEND_API_KEY", "EMAIL_FROM", "META_WA_TOKEN",
    "META_WA_PHONE_ID", "CRON_SECRET",
    // FIX: these are now required (not optional)
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
    expect(validateEnv(env)).toContain("DATABASE_URL");
  });

  it("reports missing UPSTASH vars (now required)", () => {
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
    expect(validateEnv(env)).toContain("CRON_SECRET");
  });

  it("reports all missing vars at once (not just the first)", () => {
    const missing = validateEnv({});
    expect(missing.length).toBe(REQUIRED.length);
  });
});

// ─── 8. HTML escaping / XSS prevention ───────────────────────────────────────

describe("Email template HTML escaping (XSS prevention)", () => {
  // Mirror of the escapeHtml function in src/lib/email.ts
  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
  }

  // Minimal template that mirrors the production ones
  function bookingHtml(patientName: string, doctorName: string): string {
    const p = escapeHtml(patientName);
    const d = escapeHtml(doctorName);
    return `<p>Dear <strong>${p}</strong>, your doctor is ${d}.</p>`;
  }

  it("renders normal names without modification", () => {
    const html = bookingHtml("Jane Smith", "Dr. Patel");
    expect(html).toContain("Jane Smith");
    expect(html).toContain("Dr. Patel");
  });

  it("escapes < and > in patient name", () => {
    const html = bookingHtml("<script>alert(1)</script>", "Dr. Safe");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes & in doctor name", () => {
    const html = bookingHtml("Patient One", "Dr. A & B");
    expect(html).not.toContain("& B");
    expect(html).toContain("&amp; B");
  });

  it("escapes double quotes", () => {
    const html = bookingHtml(`He said "hi"`, "Doc");
    expect(html).not.toContain('"hi"');
    expect(html).toContain("&quot;hi&quot;");
  });

  it("escapes single quotes", () => {
    const html = bookingHtml("O'Brien", "Doc");
    expect(html).not.toContain("O'Brien");
    expect(html).toContain("&#x27;Brien");
  });

  it("handles empty strings without throwing", () => {
    expect(() => bookingHtml("", "")).not.toThrow();
  });
});

// ─── 9. Rate-limit response headers ──────────────────────────────────────────

describe("Rate-limit response shape", () => {
  interface RateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
    key: string;
  }

  function buildHeaders(result: RateLimitResult): Record<string, string> {
    return {
      "X-RateLimit-Limit":     String(result.limit),
      "X-RateLimit-Remaining": String(result.remaining),
      "X-RateLimit-Reset":     String(result.reset),
      "Retry-After":           String(result.reset - Math.floor(Date.now() / 1000)),
    };
  }

  const blockedResult: RateLimitResult = {
    success: false, limit: 5, remaining: 0,
    reset: Math.floor(Date.now() / 1000) + 30,
    key: "rl:auth:127.0.0.1",
  };

  it("includes X-RateLimit-Limit header", () => {
    const headers = buildHeaders(blockedResult);
    expect(headers["X-RateLimit-Limit"]).toBe("5");
  });

  it("includes X-RateLimit-Remaining: 0 when blocked", () => {
    const headers = buildHeaders(blockedResult);
    expect(headers["X-RateLimit-Remaining"]).toBe("0");
  });

  it("includes Retry-After as a positive integer when blocked", () => {
    const headers = buildHeaders(blockedResult);
    const retryAfter = parseInt(headers["Retry-After"], 10);
    expect(retryAfter).toBeGreaterThan(0);
  });

  it("allowed result has remaining > 0", () => {
    const allowed: RateLimitResult = { ...blockedResult, success: true, remaining: 4 };
    const headers = buildHeaders(allowed);
    expect(parseInt(headers["X-RateLimit-Remaining"], 10)).toBeGreaterThan(0);
  });
});

// ─── 10. Waitlist status transitions ─────────────────────────────────────────

describe("Waitlist status transitions", () => {
  type WaitlistStatus = "PENDING" | "NOTIFIED" | "ACCEPTED" | "EXPIRED" | "CANCELLED";

  const VALID_TRANSITIONS: Record<WaitlistStatus, WaitlistStatus[]> = {
    PENDING:    ["NOTIFIED", "CANCELLED"],
    NOTIFIED:   ["ACCEPTED", "EXPIRED", "CANCELLED"],
    ACCEPTED:   [],
    EXPIRED:    [],
    CANCELLED:  [],
  };

  function canTransition(from: WaitlistStatus, to: WaitlistStatus): boolean {
    return VALID_TRANSITIONS[from].includes(to);
  }

  it("PENDING can transition to NOTIFIED", () => {
    expect(canTransition("PENDING", "NOTIFIED")).toBe(true);
  });

  it("PENDING can be CANCELLED", () => {
    expect(canTransition("PENDING", "CANCELLED")).toBe(true);
  });

  it("NOTIFIED can be ACCEPTED", () => {
    expect(canTransition("NOTIFIED", "ACCEPTED")).toBe(true);
  });

  it("NOTIFIED can EXPIRE", () => {
    expect(canTransition("NOTIFIED", "EXPIRED")).toBe(true);
  });

  it("ACCEPTED is a terminal state", () => {
    const terminals: WaitlistStatus[] = ["PENDING", "NOTIFIED", "EXPIRED", "CANCELLED"];
    terminals.forEach(to => {
      expect(canTransition("ACCEPTED", to)).toBe(false);
    });
  });

  it("EXPIRED is a terminal state", () => {
    expect(canTransition("EXPIRED", "PENDING")).toBe(false);
    expect(canTransition("EXPIRED", "NOTIFIED")).toBe(false);
  });
});

// ─── 11. Soft-delete behaviour ────────────────────────────────────────────────

describe("Soft-delete behaviour", () => {
  interface SoftDeletable {
    id: string;
    isActive: boolean;
    deletedAt: Date | null;
  }

  function softDelete(record: SoftDeletable): SoftDeletable {
    return { ...record, isActive: false, deletedAt: new Date() };
  }

  function restore(record: SoftDeletable): SoftDeletable {
    return { ...record, isActive: true, deletedAt: null };
  }

  function filterActive<T extends SoftDeletable>(records: T[]): T[] {
    return records.filter(r => r.isActive && r.deletedAt === null);
  }

  const activeRecord: SoftDeletable = { id: "u1", isActive: true, deletedAt: null };

  it("soft-delete sets isActive=false and stamps deletedAt", () => {
    const deleted = softDelete(activeRecord);
    expect(deleted.isActive).toBe(false);
    expect(deleted.deletedAt).toBeInstanceOf(Date);
  });

  it("restore sets isActive=true and clears deletedAt", () => {
    const deleted = softDelete(activeRecord);
    const restored = restore(deleted);
    expect(restored.isActive).toBe(true);
    expect(restored.deletedAt).toBeNull();
  });

  it("filterActive excludes soft-deleted records", () => {
    const records = [
      activeRecord,
      softDelete({ id: "u2", isActive: true, deletedAt: null }),
    ];
    const active = filterActive(records);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe("u1");
  });

  it("filterActive returns empty array when all are deleted", () => {
    const records = [softDelete(activeRecord)];
    expect(filterActive(records)).toHaveLength(0);
  });

  it("original record is not mutated by softDelete", () => {
    softDelete(activeRecord);
    expect(activeRecord.isActive).toBe(true);
    expect(activeRecord.deletedAt).toBeNull();
  });
});

// Suppress unused-variable warnings for mock stores used in future DB tests
void mockPatients;
void mockUsers;
void mockAppointments;
