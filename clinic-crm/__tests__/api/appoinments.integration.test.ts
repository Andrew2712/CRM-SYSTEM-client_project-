/**
 * __tests__/api/appointments.integration.test.ts
 *
 * Integration tests for GET /api/appointments and POST /api/appointments.
 * Mocks Prisma and NextAuth — no live DB needed.
 *
 * ROOT CAUSE OF "Argument of type X is not assignable to parameter of type 'never'":
 *   strict: true causes ts-jest to infer jest.fn() return type as `never` when no
 *   return-type generic is supplied. Fix: declare every mock fn with an explicit
 *   return-type generic, OR cast to (jest.Mock) at each call site.
 *
 * ROOT CAUSE OF "Object is of type 'unknown'":
 *   @jest/globals types require() results as unknown. Cast via the asMock() helper.
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";

// ── Session shapes ─────────────────────────────────────────────────────────────

type SessionRole = "ADMIN" | "DOCTOR" | "RECEPTIONIST" | "PATIENT";
type MockSession = { user: { id: string; role: SessionRole; name: string; email: string } };

const adminSession: MockSession = {
  user: { id: "user-admin-1", role: "ADMIN", name: "Admin", email: "admin@clinic.com" },
};

// ── Module mocks ───────────────────────────────────────────────────────────────

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth",          () => ({ authOptions: {} }));
jest.mock("@/lib/envValidation", () => ({ validateEnv: jest.fn() }));

jest.mock("@/lib/notificationWorkflow", () => ({
  sendBookingConfirmations: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));
jest.mock("@/lib/audit", () => ({
  auditAppointment: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));
jest.mock("@/lib/bookingConflict", () => ({
  findOverlappingAppointment: jest.fn<() => Promise<null>>(),
}));
jest.mock("@/lib/rateLimit", () => ({
  rateLimitRead:     jest.fn<() => Promise<{ success: boolean }>>().mockResolvedValue({ success: true }),
  rateLimitWrite:    jest.fn<() => Promise<{ success: boolean }>>().mockResolvedValue({ success: true }),
  rateLimitResponse: jest.fn<() => Response>(),
  getClientIp:       jest.fn<() => string>().mockReturnValue("127.0.0.1"),
}));

// ── Prisma mock ────────────────────────────────────────────────────────────────

type AnyRow    = Record<string, unknown>;
type AnyRowArr = Record<string, unknown>[];

const mockAppointment: AnyRow = {
  id:              "appt-001",
  patientId:       "patient-001",
  doctorId:        "doctor-001",
  startTime:       new Date("2026-06-10T09:00:00.000Z"),
  endTime:         new Date("2026-06-10T10:00:00.000Z"),
  sessionType:     "FOLLOW_UP",
  status:          "CONFIRMED",
  notes:           null,
  rescheduleCount: 0,
  createdAt:       new Date(),
  reminder24hSent: false,
  reminder2hSent:  false,
  patient: { id: "patient-001", name: "Test Patient", phone: "+919876543210", email: "patient@test.com" },
  doctor:  { id: "doctor-001", name: "Dr. Test" },
};

const mockPrisma = {
  appointment: {
    findMany:   jest.fn<() => Promise<AnyRowArr>>(),
    findUnique: jest.fn<() => Promise<AnyRow | null>>(),
    create:     jest.fn<() => Promise<AnyRow>>(),
    count:      jest.fn<() => Promise<number>>(),
  },
  user:    { findUnique: jest.fn<() => Promise<AnyRow | null>>() },
  patient: { findUnique: jest.fn<() => Promise<AnyRow | null>>() },
  $transaction: jest.fn<(fn: (tx: typeof mockPrisma) => Promise<AnyRow>) => Promise<AnyRow>>(),
};

jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ── Helper ─────────────────────────────────────────────────────────────────────

function makeRequest(method: string, url: string, body?: unknown): NextRequest {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body    = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(new URL(url, "http://localhost"), init);
}

/** Cast a require()-retrieved mock to jest.Mock so .mockResolvedValue is typed. */
function asMock(fn: unknown): jest.Mock {
  return fn as jest.Mock;
}

// ── GET /api/appointments ──────────────────────────────────────────────────────

describe("GET /api/appointments — pagination", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    asMock(require("next-auth").getServerSession).mockResolvedValue(adminSession);
  });

  it("returns 200 with data + nextCursor + hasMore=false when results fit within limit", async () => {
    const { GET } = await import("@/app/api/appointments/route");
    mockPrisma.appointment.findMany.mockResolvedValue([mockAppointment]);

    const res  = await GET(makeRequest("GET", "http://localhost/api/appointments?limit=50"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.hasMore).toBe(false);
    expect(json.nextCursor).toBeNull();
  });

  it("returns hasMore=true and nextCursor when more rows exist", async () => {
    const { GET } = await import("@/app/api/appointments/route");
    const rows = Array.from({ length: 3 }, (_, i) => ({ ...mockAppointment, id: `appt-${i}` }));
    mockPrisma.appointment.findMany.mockResolvedValue(rows);

    const res  = await GET(makeRequest("GET", "http://localhost/api/appointments?limit=2"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(2);
    expect(json.hasMore).toBe(true);
    expect(json.nextCursor).toBe("appt-1");
  });

  it("clamps limit to MAX_LIMIT of 100", async () => {
    const { GET } = await import("@/app/api/appointments/route");
    mockPrisma.appointment.findMany.mockResolvedValue([]);

    await GET(makeRequest("GET", "http://localhost/api/appointments?limit=9999"));

    const take = asMock(mockPrisma.appointment.findMany).mock.calls[0][0].take as number;
    expect(take).toBe(101); // MAX_LIMIT(100) + 1 for hasMore detection
  });

  it("returns 401 when unauthenticated", async () => {
    const { GET } = await import("@/app/api/appointments/route");
    asMock(require("next-auth").getServerSession).mockResolvedValue(null);

    const res = await GET(makeRequest("GET", "http://localhost/api/appointments"));
    expect(res.status).toBe(401);
  });

  it("scopes appointments to doctorId when role is DOCTOR", async () => {
    const { GET } = await import("@/app/api/appointments/route");
    asMock(require("next-auth").getServerSession).mockResolvedValue({
      user: { id: "doc-42", role: "DOCTOR", name: "Dr. X", email: "dr@clinic.com" },
    });
    mockPrisma.appointment.findMany.mockResolvedValue([]);

    await GET(makeRequest("GET", "http://localhost/api/appointments"));

    const where = asMock(mockPrisma.appointment.findMany).mock.calls[0][0].where;
    expect(where.doctorId).toBe("doc-42");
  });
});

// ── POST /api/appointments ─────────────────────────────────────────────────────

describe("POST /api/appointments — booking creation", () => {
  const validBody = {
    patientId:   "patient-001",
    doctorId:    "doctor-001",
    sessionType: "FOLLOW_UP",
    startTime:   "2026-06-10T09:00:00.000Z",
    endTime:     "2026-06-10T10:00:00.000Z",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    asMock(require("next-auth").getServerSession).mockResolvedValue(adminSession);

    asMock(require("@/lib/bookingConflict").findOverlappingAppointment).mockResolvedValue(null);

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<AnyRow>) => fn(mockPrisma)
    );
    mockPrisma.appointment.create.mockResolvedValue(mockAppointment);
    mockPrisma.appointment.findUnique.mockResolvedValue(null);
    mockPrisma.appointment.count.mockResolvedValue(1);
    mockPrisma.user.findUnique.mockResolvedValue({ id: "doctor-001", isActive: true });
    mockPrisma.patient.findUnique.mockResolvedValue({ id: "patient-001", name: "Test Patient", isActive: true });
  });

  it("creates appointment and returns 201 on valid input", async () => {
    const { POST } = await import("@/app/api/appointments/route");
    const res  = await POST(makeRequest("POST", "http://localhost/api/appointments", validBody));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.id).toBe("appt-001");
  });

  it("returns 400 on missing required field (doctorId)", async () => {
    const { POST } = await import("@/app/api/appointments/route");
    const res = await POST(makeRequest("POST", "http://localhost/api/appointments", {
      ...validBody, doctorId: undefined,
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when startTime >= endTime", async () => {
    const { POST } = await import("@/app/api/appointments/route");
    const res  = await POST(makeRequest("POST", "http://localhost/api/appointments", {
      ...validBody,
      startTime: "2026-06-10T10:00:00.000Z",
      endTime:   "2026-06-10T09:00:00.000Z",
    }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/after/i);
  });

  it("returns 403 when DOCTOR tries to book for another doctor", async () => {
    const { POST } = await import("@/app/api/appointments/route");
    asMock(require("next-auth").getServerSession).mockResolvedValue({
      user: { id: "doctor-999", role: "DOCTOR", name: "Dr. Other", email: "other@clinic.com" },
    });

    const res = await POST(makeRequest("POST", "http://localhost/api/appointments", validBody));
    expect(res.status).toBe(403);
  });

  it("returns 409 when a booking conflict is detected", async () => {
    const { POST } = await import("@/app/api/appointments/route");
    asMock(require("@/lib/bookingConflict").findOverlappingAppointment).mockResolvedValue({
      id:        "existing-appt",
      startTime: new Date("2026-06-10T08:30:00.000Z"),
      endTime:   new Date("2026-06-10T09:30:00.000Z"),
    });

    const res  = await POST(makeRequest("POST", "http://localhost/api/appointments", validBody));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toMatch(/already been booked/i);
  });

  it("returns 401 when unauthenticated", async () => {
    const { POST } = await import("@/app/api/appointments/route");
    asMock(require("next-auth").getServerSession).mockResolvedValue(null);

    const res = await POST(makeRequest("POST", "http://localhost/api/appointments", validBody));
    expect(res.status).toBe(401);
  });
});

// ── Rate limit ─────────────────────────────────────────────────────────────────

describe("GET /api/appointments — rate limit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    asMock(require("next-auth").getServerSession).mockResolvedValue(adminSession);
  });

  it("returns 429 when rate limit is exceeded", async () => {
    const { GET } = await import("@/app/api/appointments/route");
    const { rateLimitRead, rateLimitResponse } = require("@/lib/rateLimit");

    asMock(rateLimitRead).mockResolvedValue({
      success: false, limit: 100, remaining: 0, reset: 9999, key: "rl:read:127.0.0.1",
    });
    asMock(rateLimitResponse).mockReturnValue(
      new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 })
    );

    const res = await GET(makeRequest("GET", "http://localhost/api/appointments"));
    expect(res.status).toBe(429);
  });
});
