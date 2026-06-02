/**
 * __tests__/api/session-revocation.test.ts
 *
 * Tests for revokeUserSessions() and restoreUserSessions() in auth.ts.
 *
 * ROOT CAUSE OF "Argument of type X is not assignable to parameter of type 'never'":
 *   strict: true causes ts-jest to infer jest.fn() as () => never when no
 *   generic is supplied. Fix: type every mock fn explicitly with jest.fn<...>()
 *   or cast mockResolvedValue/mockRejectedValue calls with `as jest.Mock`.
 *
 * ROOT CAUSE OF "Object is of type 'unknown'":
 *   jest.Mock from @jest/globals types the call as unknown without an explicit
 *   cast. Fix: cast to (jest.Mock) before chaining mockResolvedValue etc.
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// ── Redis mock ────────────────────────────────────────────────────────────────
// getRedis() does: const { Redis } = await import("@upstash/redis")
// Jest intercepts the dynamic import via this factory.

const mockRedis = {
  set: jest.fn<() => Promise<string>>(),
  del: jest.fn<() => Promise<number>>(),
  get: jest.fn<() => Promise<string | null>>(),
};

const MockRedisConstructor = jest.fn(() => mockRedis);

jest.mock("@upstash/redis", () => ({
  Redis: MockRedisConstructor,
}));

// Mock Prisma so auth.ts can be imported without a real DB.
// authorize() references prisma.user and prisma.patient even though
// revokeUserSessions / restoreUserSessions do not use them.
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user:    { findUnique: jest.fn<() => Promise<null>>() },
    patient: { findFirst:  jest.fn<() => Promise<null>>() },
  },
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("revokeUserSessions()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Valid-looking env vars so getRedis() constructs a client instead of
    // short-circuiting (isRevoked checks for UPSTASH_REDIS_REST_URL).
    process.env.UPSTASH_REDIS_REST_URL   = "https://fake-redis.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
  });

  it("sets a denylist key in Redis with the correct userId and TTL", async () => {
    const { revokeUserSessions } = await import("@/lib/auth");
    (mockRedis.set as jest.Mock).mockResolvedValue("OK");

    await revokeUserSessions("user-abc-123");

    expect(mockRedis.set).toHaveBeenCalledWith(
      "revoked:user-abc-123",
      "1",
      { ex: 8 * 60 * 60 }   // REVOKE_TTL — 8 hours
    );
  });

  it("resolves to undefined when called for a user with no active sessions", async () => {
    const { revokeUserSessions } = await import("@/lib/auth");
    (mockRedis.set as jest.Mock).mockResolvedValue("OK");

    await expect(revokeUserSessions("user-no-sessions")).resolves.toBeUndefined();
    expect(mockRedis.set).toHaveBeenCalledTimes(1);
  });

  it("propagates Redis errors to the caller", async () => {
    const { revokeUserSessions } = await import("@/lib/auth");
    (mockRedis.set as jest.Mock).mockRejectedValue(new Error("Redis connection refused"));

    await expect(revokeUserSessions("user-123")).rejects.toThrow("Redis connection refused");
  });
});

describe("restoreUserSessions()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.UPSTASH_REDIS_REST_URL   = "https://fake-redis.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
  });

  it("deletes the denylist key from Redis", async () => {
    const { restoreUserSessions } = await import("@/lib/auth");
    (mockRedis.del as jest.Mock).mockResolvedValue(1);

    await restoreUserSessions("user-abc-123");

    expect(mockRedis.del).toHaveBeenCalledWith("revoked:user-abc-123");
  });

  it("propagates Redis errors to the caller", async () => {
    const { restoreUserSessions } = await import("@/lib/auth");
    (mockRedis.del as jest.Mock).mockRejectedValue(new Error("Redis timeout"));

    await expect(restoreUserSessions("user-123")).rejects.toThrow("Redis timeout");
  });
});
