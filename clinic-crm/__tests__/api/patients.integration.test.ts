/**
 * __tests__/api/patients.integration.test.ts
 *
 * Integration tests for the patients API routes.
 * Covers GET pagination, POST creation, RBAC, and validation.
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockAdminSession = {
  user: { id: "admin-1", role: "ADMIN" as const, name: "Admin", email: "admin@clinic.com" },
};
const mockDoctorSession = {
  user: { id: "doc-1", role: "DOCTOR" as const, name: "Dr. Test", email: "dr@clinic.com" },
};

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));

const mockPatient = {
  id: "pat-001",
  patientCode: "PHY-2026-0001",
  name: "Anjali Sharma",
  phone: "+919876543210",
  email: "anjali@example.com",
  isActive: true,
  createdAt: new Date(),
  status: "NEW",
  appointments: [],
  _count: { appointments: 0 },
};

const mockPrisma = {
  patient: {
    findMany:  jest.fn(),
    findFirst: jest.fn(),
    create:    jest.fn(),
  },
};
jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

jest.mock("@/lib/rateLimit", () => ({
  rateLimitRead:  jest.fn().mockResolvedValue({ success: true }),
  rateLimitWrite: jest.fn().mockResolvedValue({ success: true }),
  rateLimitResponse: jest.fn(),
  getClientIp: jest.fn().mockReturnValue("127.0.0.1"),
}));

jest.mock("@/lib/audit", () => ({ auditPatient: jest.fn().mockResolvedValue(undefined) }));

// ── Helper ────────────────────────────────────────────────────────────────────

function makeRequest(method: string, url: string, body?: unknown): NextRequest {
  const init: RequestInit = { method };
  if (body) {
    init.body    = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(new URL(url, "http://localhost"), init);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/patients — pagination", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { getServerSession } = require("next-auth");
    (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
  });

  it("returns paginated data with hasMore=false when fewer results than limit", async () => {
    const { GET } = await import("@/app/api/patients/route");
    mockPrisma.patient.findMany.mockResolvedValue([mockPatient]);

    const req = makeRequest("GET", "http://localhost/api/patients?limit=50");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.hasMore).toBe(false);
    expect(json.nextCursor).toBeNull();
    expect(json.data).toHaveLength(1);
  });

  it("returns hasMore=true and correct nextCursor when more rows exist", async () => {
    const { GET } = await import("@/app/api/patients/route");
    const rows = [
      { ...mockPatient, id: "pat-001" },
      { ...mockPatient, id: "pat-002" },
      { ...mockPatient, id: "pat-003" }, // +1 extra signals next page
    ];
    mockPrisma.patient.findMany.mockResolvedValue(rows);

    const req = makeRequest("GET", "http://localhost/api/patients?limit=2");
    const res = await GET(req);
    const json = await res.json();

    expect(json.hasMore).toBe(true);
    expect(json.nextCursor).toBe("pat-002");
    expect(json.data).toHaveLength(2);
  });

  it("scopes to doctor's own patients when role is DOCTOR", async () => {
    const { GET } = await import("@/app/api/patients/route");
    const { getServerSession } = require("next-auth");
    (getServerSession as jest.Mock).mockResolvedValue(mockDoctorSession);
    mockPrisma.patient.findMany.mockResolvedValue([]);

    const req = makeRequest("GET", "http://localhost/api/patients");
    await GET(req);

    const where = (mockPrisma.patient.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.appointments?.some?.doctorId).toBe("doc-1");
  });

  it("filters by search term when provided", async () => {
    const { GET } = await import("@/app/api/patients/route");
    mockPrisma.patient.findMany.mockResolvedValue([]);

    const req = makeRequest("GET", "http://localhost/api/patients?search=anjali");
    await GET(req);

    const where = (mockPrisma.patient.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.OR).toBeDefined();
    expect(where.OR[0].name.contains).toBe("anjali");
  });
});

describe("POST /api/patients — creation", () => {
  const validBody = {
    name:  "Ravi Kumar",
    phone: "+919876543211",
    email: "ravi@example.com",
    totalSessionsPlanned: 10,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const { getServerSession } = require("next-auth");
    (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
    mockPrisma.patient.findFirst.mockResolvedValue(null); // no existing code
    mockPrisma.patient.create.mockResolvedValue({ ...mockPatient, name: "Ravi Kumar" });
  });

  it("creates patient and returns 201 with valid input", async () => {
    const { POST } = await import("@/app/api/patients/route");

    const req = makeRequest("POST", "http://localhost/api/patients", validBody);
    const res = await POST(req);

    expect(res.status).toBe(201);
  });

  it("returns 403 when DOCTOR tries to create a patient", async () => {
    const { POST } = await import("@/app/api/patients/route");
    const { getServerSession } = require("next-auth");
    (getServerSession as jest.Mock).mockResolvedValue(mockDoctorSession);

    const req = makeRequest("POST", "http://localhost/api/patients", validBody);
    const res = await POST(req);

    expect(res.status).toBe(403);
  });

  it("returns 400 with invalid phone number", async () => {
    const { POST } = await import("@/app/api/patients/route");

    const req = makeRequest("POST", "http://localhost/api/patients", {
      ...validBody,
      phone: "not-a-phone",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when name is too short", async () => {
    const { POST } = await import("@/app/api/patients/route");

    const req = makeRequest("POST", "http://localhost/api/patients", {
      ...validBody,
      name: "A",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    const { POST } = await import("@/app/api/patients/route");
    const { getServerSession } = require("next-auth");
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const req = makeRequest("POST", "http://localhost/api/patients", validBody);
    const res = await POST(req);

    expect(res.status).toBe(401);
  });
});
