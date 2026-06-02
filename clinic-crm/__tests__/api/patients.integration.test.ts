/**
 * __tests__/api/patients.integration.test.ts
 *
 * Integration tests for GET /api/patients and POST /api/patients.
 *
 * WHY jest.isolateModules() / jest.resetModules():
 *   Jest caches every dynamic import() in its module registry for the
 *   lifetime of the test file. If test A calls `await import("@/app/api/patients/route")`
 *   and test B also calls it, B gets the SAME cached module — including any
 *   internal state that was set during test A. More critically, the cached
 *   module captured the mock references at first-import time. After
 *   jest.clearAllMocks() the mock fns are reset but the module cache still
 *   holds references to the OLD mock objects, which can cause mock behaviour
 *   to bleed between tests (test A sets findUnique → patient, test B expects
 *   findUnique → null, but the route still sees the cached mock).
 *
 *   Fix: call jest.resetModules() in every beforeEach so each test gets a
 *   fresh module import with the current mock state.
 *
 * WHY "name: A" returned 201 before the fix:
 *   The route was cached from the very first test (which mocked findUnique → null
 *   and create → patient). The cached closure held the FIRST mock snapshot.
 *   When test 2 sent name:"A" (which Zod should reject), the route still ran
 *   with the stale mock wiring and returned 201.
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";

// ── Module mocks (registered once — jest.resetModules keeps them active) ───────

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth",          () => ({ authOptions: {} }));
jest.mock("@/lib/envValidation", () => ({ validateEnv: jest.fn() }));
jest.mock("@/lib/audit",         () => ({
  auditPatient: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));
jest.mock("@/lib/rateLimit", () => ({
  rateLimitRead:     jest.fn<() => Promise<{ success: boolean }>>().mockResolvedValue({ success: true }),
  rateLimitWrite:    jest.fn<() => Promise<{ success: boolean }>>().mockResolvedValue({ success: true }),
  rateLimitResponse: jest.fn<() => Response>(),
  getClientIp:       jest.fn<() => string>().mockReturnValue("127.0.0.1"),
}));
jest.mock("bcryptjs", () => ({
  hash: jest.fn<() => Promise<string>>().mockResolvedValue("hashed-pw"),
}));

// ── Prisma mock ───────────────────────────────────────────────────────────────

type AnyRow    = Record<string, unknown>;
type AnyRowArr = Record<string, unknown>[];

const mockPatient: AnyRow = {
  id:                   "patient-001",
  patientCode:          "PHY-2026-0001",
  name:                 "Ravi Kumar",
  phone:                "+919876543210",
  email:                "ravi@example.com",
  age:                  35,
  gender:               "MALE",
  address:              "Bengaluru",
  status:               "NEW",
  phase:                null,
  purposeOfVisit:       null,
  medicalConditions:    null,
  totalSessionsPlanned: 0,
  isActive:             true,
  deletedAt:            null,
  createdAt:            new Date("2026-01-01"),
  passwordHash:         "hashed",
  dob:                  null,
  appointments:         [],
  visits:               [],
  waitlistEntries:      [],
  _count:               { appointments: 0 },
};

const mockPrisma = {
  patient: {
    findMany:   jest.fn<() => Promise<AnyRowArr>>(),
    findUnique: jest.fn<() => Promise<AnyRow | null>>(),
    findFirst:  jest.fn<() => Promise<AnyRow | null>>(),
    create:     jest.fn<() => Promise<AnyRow>>(),
  },
};
jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

jest.mock("@/lib/patientActivity", () => ({
  activityInclude: {},
  enrichWithActivity: (rows: AnyRowArr) =>
    rows.map((r) => ({ ...r, activityStatus: "ACTIVE", daysSinceLastVisit: null })),
}));

// ── Session fixtures ──────────────────────────────────────────────────────────

type SessionRole = "ADMIN" | "DOCTOR" | "RECEPTIONIST";
type MockSession = { user: { id: string; role: SessionRole; name: string; email: string } };

const adminSession:        MockSession = { user: { id: "user-admin-1", role: "ADMIN",        name: "Admin",  email: "admin@clinic.com" } };
const doctorSession:       MockSession = { user: { id: "doctor-001",   role: "DOCTOR",       name: "Dr. A",  email: "dr@clinic.com"    } };
const receptionistSession: MockSession = { user: { id: "recept-001",   role: "RECEPTIONIST", name: "Recept", email: "r@clinic.com"     } };

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(method: string, url: string, body?: unknown): NextRequest {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body    = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(new URL(url, "http://localhost"), init);
}

function asMock(fn: unknown): jest.Mock {
  return fn as jest.Mock;
}

// ── GET /api/patients ─────────────────────────────────────────────────────────

describe("GET /api/patients", () => {
  beforeEach(() => {
    // ← KEY FIX: reset the module registry before every test so each
    // `await import(...)` below gets a fresh module wired to the current mocks.
    jest.resetModules();
    jest.clearAllMocks();

    // Re-apply default mock return values AFTER clearAllMocks
    asMock(require("next-auth").getServerSession).mockResolvedValue(adminSession);
    mockPrisma.patient.findMany.mockResolvedValue([]);
  });

  it("returns 200 with data + pagination fields", async () => {
    const { GET } = await import("@/app/api/patients/route");
    mockPrisma.patient.findMany.mockResolvedValue([mockPatient]);

    const res  = await GET(makeRequest("GET", "http://localhost/api/patients?limit=50"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].name).toBe("Ravi Kumar");
    expect(json).toHaveProperty("nextCursor");
    expect(json).toHaveProperty("hasMore");
    expect(json.hasMore).toBe(false);
  });

  it("returns hasMore=true and nextCursor when more rows exist beyond limit", async () => {
    const { GET } = await import("@/app/api/patients/route");
    const rows = Array.from({ length: 3 }, (_, i) => ({ ...mockPatient, id: `p-${i}` }));
    mockPrisma.patient.findMany.mockResolvedValue(rows);

    const res  = await GET(makeRequest("GET", "http://localhost/api/patients?limit=2"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(2);
    expect(json.hasMore).toBe(true);
    expect(json.nextCursor).toBe("p-1");
  });

  it("returns 401 when unauthenticated", async () => {
    const { GET } = await import("@/app/api/patients/route");
    asMock(require("next-auth").getServerSession).mockResolvedValue(null);

    const res = await GET(makeRequest("GET", "http://localhost/api/patients"));
    expect(res.status).toBe(401);
  });

  it("scopes results to the doctor's own patients when role is DOCTOR", async () => {
    const { GET } = await import("@/app/api/patients/route");
    asMock(require("next-auth").getServerSession).mockResolvedValue(doctorSession);

    await GET(makeRequest("GET", "http://localhost/api/patients"));

    const where = asMock(mockPrisma.patient.findMany).mock.calls[0][0].where;
    expect(where.appointments).toEqual({ some: { doctorId: "doctor-001" } });
  });

  it("returns empty data array when no patients match", async () => {
    const { GET } = await import("@/app/api/patients/route");

    const res  = await GET(makeRequest("GET", "http://localhost/api/patients"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual([]);
    expect(json.hasMore).toBe(false);
    expect(json.nextCursor).toBeNull();
  });

  it("clamps limit to MAX_LIMIT of 100", async () => {
    const { GET } = await import("@/app/api/patients/route");

    await GET(makeRequest("GET", "http://localhost/api/patients?limit=9999"));

    const take = asMock(mockPrisma.patient.findMany).mock.calls[0][0].take;
    expect(take).toBe(101);
  });

  it("returns 429 when rate limit is exceeded", async () => {
    const { GET } = await import("@/app/api/patients/route");
    const { rateLimitRead, rateLimitResponse } = require("@/lib/rateLimit");
    asMock(rateLimitRead).mockResolvedValue({
      success: false, limit: 100, remaining: 0, reset: 9999, key: "rl:read:127.0.0.1",
    });
    asMock(rateLimitResponse).mockReturnValue(
      new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 })
    );

    const res = await GET(makeRequest("GET", "http://localhost/api/patients"));
    expect(res.status).toBe(429);
  });
});

// ── POST /api/patients ────────────────────────────────────────────────────────

describe("POST /api/patients", () => {
  const validBody = {
    name:                 "Priya Sharma",
    phone:                "+919123456789",
    email:                "priya@example.com",
    age:                  28,
    gender:               "FEMALE",
    totalSessionsPlanned: 10,
  };

  beforeEach(() => {
    // ← KEY FIX: fresh module import for every POST test too
    jest.resetModules();
    jest.clearAllMocks();

    asMock(require("next-auth").getServerSession).mockResolvedValue(adminSession);

    // Default: no duplicate phone, no code collision, create succeeds
    mockPrisma.patient.findUnique.mockResolvedValue(null);
    mockPrisma.patient.findFirst.mockResolvedValue(null);
    mockPrisma.patient.create.mockResolvedValue({
      ...mockPatient,
      name:  "Priya Sharma",
      phone: "+919123456789",
      email: "priya@example.com",
    });
  });

  it("creates a patient and returns 201 with credentials", async () => {
    const { POST } = await import("@/app/api/patients/route");
    const res  = await POST(makeRequest("POST", "http://localhost/api/patients", validBody));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.name).toBe("Priya Sharma");
    expect(json._credentials).toBeTruthy();
    expect(json._credentials.username).toBe("priya@example.com");
  });

  it("returns 400 when name is too short (< 2 chars)", async () => {
    const { POST } = await import("@/app/api/patients/route");
    // "A" has length 1 → Zod min(2) rejects → validate() returns { error, status: 400 }
    const res = await POST(makeRequest("POST", "http://localhost/api/patients", {
      ...validBody, name: "A",
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when phone format is invalid", async () => {
    const { POST } = await import("@/app/api/patients/route");
    // "not-a-phone" fails /^\+?[0-9]{10,15}$/ → Zod rejects → 400
    const res = await POST(makeRequest("POST", "http://localhost/api/patients", {
      ...validBody, phone: "not-a-phone",
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when required fields (phone) are missing", async () => {
    const { POST } = await import("@/app/api/patients/route");
    const res = await POST(makeRequest("POST", "http://localhost/api/patients", { name: "Only Name" }));
    expect(res.status).toBe(400);
  });

  it("returns 409 when a patient with the same phone already exists", async () => {
    const { POST } = await import("@/app/api/patients/route");
    mockPrisma.patient.findUnique.mockResolvedValue(mockPatient);

    const res  = await POST(makeRequest("POST", "http://localhost/api/patients", validBody));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toMatch(/already exists/i);
  });

  it("returns 400 on malformed JSON body", async () => {
    const { POST } = await import("@/app/api/patients/route");
    const req = new NextRequest("http://localhost/api/patients", {
      method:  "POST",
      body:    "this is not json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 403 when a DOCTOR tries to create a patient", async () => {
    const { POST } = await import("@/app/api/patients/route");
    asMock(require("next-auth").getServerSession).mockResolvedValue(doctorSession);

    const res = await POST(makeRequest("POST", "http://localhost/api/patients", validBody));
    expect(res.status).toBe(403);
  });

  it("allows RECEPTIONIST to create a patient", async () => {
    const { POST } = await import("@/app/api/patients/route");
    asMock(require("next-auth").getServerSession).mockResolvedValue(receptionistSession);

    const res = await POST(makeRequest("POST", "http://localhost/api/patients", validBody));
    expect(res.status).toBe(201);
  });

  it("returns 401 when unauthenticated", async () => {
    const { POST } = await import("@/app/api/patients/route");
    asMock(require("next-auth").getServerSession).mockResolvedValue(null);

    const res = await POST(makeRequest("POST", "http://localhost/api/patients", validBody));
    expect(res.status).toBe(401);
  });

  it("omits _credentials when no email is provided", async () => {
    const { POST } = await import("@/app/api/patients/route");
    mockPrisma.patient.create.mockResolvedValue({ ...mockPatient, name: "No Email", email: null });

    const res  = await POST(makeRequest("POST", "http://localhost/api/patients", {
      name: "No Email Patient", phone: "+919000000001",
    }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json._credentials).toBeNull();
  });
});
