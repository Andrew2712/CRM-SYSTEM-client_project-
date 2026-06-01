/**
 * __tests__/api/appointments.integration.test.ts
 *
 * Integration tests for the appointments API routes using supertest-style
 * mocking with jest and next-test-api-route-handler (or plain Next.js
 * route handler invocation with mocked modules).
 *
 * These tests cover the HTTP round-trip for the critical booking flow.
 * They mock Prisma and NextAuth so no live DB is needed in CI.
 *
 * Run:  npm run test  (or jest __tests__/api/appointments.integration.test.ts)
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";

// ── Module mocks ──────────────────────────────────────────────────────────────

// Mock next-auth session
const mockSession = {
  user: { id: "user-admin-1", role: "ADMIN" as const, name: "Admin", email: "admin@clinic.com" },
};
jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));

// Mock Prisma
const mockAppointment = {
  id: "appt-001",
  patientId: "patient-001",
  doctorId:  "doctor-001",
  startTime: new Date("2026-06-10T09:00:00.000Z"),
  endTime:   new Date("2026-06-10T10:00:00.000Z"),
  sessionType: "FOLLOW_UP",
  status: "CONFIRMED",
  notes: null,
  rescheduleCount: 0,
  createdAt: new Date(),
  reminder24hSent: false,
  reminder2hSent:  false,
  patient: { id: "patient-001", name: "Test Patient", phone: "+919876543210", email: "patient@test.com" },
  doctor:  { id: "doctor-001",  name: "Dr. Test" },
};

const mockPrisma = {
  appointment: {
    findMany:  jest.fn(),
    findUnique: jest.fn(),
    create:    jest.fn(),
  },
  $transaction: jest.fn(),
};
jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// Mock rate limiting (always pass in tests)
jest.mock("@/lib/rateLimit", () => ({
  rateLimitRead:  jest.fn().mockResolvedValue({ success: true }),
  rateLimitWrite: jest.fn().mockResolvedValue({ success: true }),
  rateLimitResponse: jest.fn(),
  getClientIp: jest.fn().mockReturnValue("127.0.0.1"),
}));

// Mock env validation (no real env needed in tests)
jest.mock("@/lib/envValidation", () => ({ validateEnv: jest.fn() }));

// Mock side-effect functions
jest.mock("@/lib/notificationWorkflow", () => ({
  sendBookingConfirmations: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/audit", () => ({
  auditAppointment: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/bookingConflict", () => ({
  findOverlappingAppointment: jest.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(
  method: string,
  url: string,
  body?: unknown
): NextRequest {
  const init: RequestInit = { method };
  if (body) {
    init.body    = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(new URL(url, "http://localhost"), init);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/appointments — pagination", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { getServerSession } = require("next-auth");
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it("returns data + nextCursor + hasMore=false when results fit within limit", async () => {
    const { GET } = await import("@/app/api/appointments/route");

    // Prisma returns exactly `limit` rows (not limit+1) → no next page
    mockPrisma.appointment.findMany.mockResolvedValue([mockAppointment]);

    const req = makeRequest("GET", "http://localhost/api/appointments?limit=50");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.hasMore).toBe(false);
    expect(json.nextCursor).toBeNull();
  });

  it("returns hasMore=true and nextCursor when more rows exist", async () => {
    const { GET } = await import("@/app/api/appointments/route");

    // Return limit+1 rows (51) to signal a next page exists
    const rows = Array.from({ length: 3 }, (_, i) => ({ ...mockAppointment, id: `appt-${i}` }));
    mockPrisma.appointment.findMany.mockResolvedValue(rows);

    const req = makeRequest("GET", "http://localhost/api/appointments?limit=2");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(2);
    expect(json.hasMore).toBe(true);
    expect(json.nextCursor).toBe("appt-1");
  });

  it("clamps limit to MAX_LIMIT of 100", async () => {
    const { GET } = await import("@/app/api/appointments/route");
    mockPrisma.appointment.findMany.mockResolvedValue([]);

    const req = makeRequest("GET", "http://localhost/api/appointments?limit=9999");
    await GET(req);

    const call = (mockPrisma.appointment.findMany as jest.Mock).mock.calls[0][0] as { take: number };
    expect(call.take).toBe(101); // 100 + 1
  });

  it("returns 401 when unauthenticated", async () => {
    const { GET } = await import("@/app/api/appointments/route");
    const { getServerSession } = require("next-auth");
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const req = makeRequest("GET", "http://localhost/api/appointments");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("scopes appointments to doctorId when role is DOCTOR", async () => {
    const { GET } = await import("@/app/api/appointments/route");
    const { getServerSession } = require("next-auth");
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "doc-42", role: "DOCTOR", name: "Dr. X", email: "dr@clinic.com" },
    });
    mockPrisma.appointment.findMany.mockResolvedValue([]);

    const req = makeRequest("GET", "http://localhost/api/appointments");
    await GET(req);

    const where = (mockPrisma.appointment.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.doctorId).toBe("doc-42");
  });
});

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
    const { getServerSession } = require("next-auth");
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);

    const { findOverlappingAppointment } = require("@/lib/bookingConflict");
    (findOverlappingAppointment as jest.Mock).mockResolvedValue(null);

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
      fn(mockPrisma)
    );
    mockPrisma.appointment.create.mockResolvedValue(mockAppointment);
    mockPrisma.appointment.findUnique.mockResolvedValue(null);
  });

  it("creates appointment and returns 201 on valid input", async () => {
    const { POST } = await import("@/app/api/appointments/route");

    const req = makeRequest("POST", "http://localhost/api/appointments", validBody);
    const res = await POST(req);

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe("appt-001");
  });

  it("returns 400 on invalid Zod schema (missing doctorId)", async () => {
    const { POST } = await import("@/app/api/appointments/route");

    const req = makeRequest("POST", "http://localhost/api/appointments", {
      ...validBody,
      doctorId: undefined,
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when startTime >= endTime", async () => {
    const { POST } = await import("@/app/api/appointments/route");

    const req = makeRequest("POST", "http://localhost/api/appointments", {
      ...validBody,
      startTime: "2026-06-10T10:00:00.000Z",
      endTime:   "2026-06-10T09:00:00.000Z",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/before/i);
  });

  it("returns 403 when DOCTOR tries to book for another doctor", async () => {
    const { POST } = await import("@/app/api/appointments/route");
    const { getServerSession } = require("next-auth");
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "doctor-999", role: "DOCTOR", name: "Dr. Other", email: "other@clinic.com" },
    });

    const req = makeRequest("POST", "http://localhost/api/appointments", validBody);
    const res = await POST(req);

    expect(res.status).toBe(403);
  });

  it("returns 409 when a booking conflict is detected", async () => {
    const { POST } = await import("@/app/api/appointments/route");
    const { findOverlappingAppointment } = require("@/lib/bookingConflict");
    (findOverlappingAppointment as jest.Mock).mockResolvedValue({
      id: "existing-appt",
      startTime: new Date("2026-06-10T08:30:00.000Z"),
      endTime:   new Date("2026-06-10T09:30:00.000Z"),
    });

    const req = makeRequest("POST", "http://localhost/api/appointments", validBody);
    const res = await POST(req);

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/conflict/i);
  });

  it("returns 401 when unauthenticated", async () => {
    const { POST } = await import("@/app/api/appointments/route");
    const { getServerSession } = require("next-auth");
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const req = makeRequest("POST", "http://localhost/api/appointments", validBody);
    const res = await POST(req);

    expect(res.status).toBe(401);
  });
});

describe("GET /api/appointments — rate limit response", () => {
  it("returns 429 when rate limit is exceeded", async () => {
    const { GET } = await import("@/app/api/appointments/route");
    const { rateLimitRead, rateLimitResponse } = require("@/lib/rateLimit");
    (rateLimitRead as jest.Mock).mockResolvedValue({ success: false, limit: 100, remaining: 0, reset: 9999, key: "rl:read:127.0.0.1" });
    (rateLimitResponse as jest.Mock).mockReturnValue(
      new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 })
    );

    const { getServerSession } = require("next-auth");
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);

    const req = makeRequest("GET", "http://localhost/api/appointments");
    const res = await GET(req);

    expect(res.status).toBe(429);
  });
});
