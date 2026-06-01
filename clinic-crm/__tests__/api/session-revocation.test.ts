/**
 * __tests__/api/session-revocation.test.ts
 *
 * Tests for the revokeUserSessions helper introduced in auth.ts.
 * Verifies that sessions are deleted from the database when a user
 * is deactivated or an admin explicitly revokes access.
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// ── Mock Prisma ───────────────────────────────────────────────────────────────

const mockPrisma = {
  session: {
    deleteMany: jest.fn(),
  },
};
jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("revokeUserSessions()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls prisma.session.deleteMany with the correct userId", async () => {
    const { revokeUserSessions } = await import("@/lib/auth");
    mockPrisma.session.deleteMany.mockResolvedValue({ count: 2 });

    const count = await revokeUserSessions("user-abc-123");

    expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-abc-123" },
    });
    expect(count).toBe(2);
  });

  it("returns 0 when the user has no active sessions", async () => {
    const { revokeUserSessions } = await import("@/lib/auth");
    mockPrisma.session.deleteMany.mockResolvedValue({ count: 0 });

    const count = await revokeUserSessions("user-no-sessions");

    expect(count).toBe(0);
  });

  it("propagates Prisma errors", async () => {
    const { revokeUserSessions } = await import("@/lib/auth");
    mockPrisma.session.deleteMany.mockRejectedValue(new Error("DB error"));

    await expect(revokeUserSessions("user-123")).rejects.toThrow("DB error");
  });
});
