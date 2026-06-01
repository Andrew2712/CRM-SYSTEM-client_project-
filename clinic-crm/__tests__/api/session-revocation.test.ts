/**
 * __tests__/api/session-revocation.test.ts
 *
 * Tests for revokeUserSessions() and restoreUserSessions() in auth.ts.
 *
 * The implementation now uses a Redis denylist (not prisma.session.deleteMany),
 * so we mock @upstash/redis instead of Prisma.
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// ── Mock @upstash/redis ───────────────────────────────────────────────────────
// getRedis() does: const { Redis } = await import("@upstash/redis")
// Jest intercepts the dynamic import via this mock.

const mockRedis = {
  set: jest.fn(),
  del: jest.fn(),
  get: jest.fn(),
};

// The Redis constructor returns our mockRedis instance.
const MockRedisConstructor = jest.fn(() => mockRedis);

jest.mock("@upstash/redis", () => ({
  Redis: MockRedisConstructor,
}));

// Mock Prisma so auth.ts can be imported (authorize() references prisma,
// even though revokeUserSessions does not use it).
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user:    { findUnique: jest.fn() },
    patient: { findFirst:  jest.fn() },
  },
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("revokeUserSessions()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Provide valid-looking env vars so getRedis() doesn't short-circuit
    process.env.UPSTASH_REDIS_REST_URL   = "https://fake-redis.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
  });

  it("sets a denylist key in Redis with the correct userId", async () => {
    const { revokeUserSessions } = await import("@/lib/auth");
    mockRedis.set.mockResolvedValue("OK");

    await revokeUserSessions("user-abc-123");

    expect(mockRedis.set).toHaveBeenCalledWith(
      "revoked:user-abc-123",
      "1",
      { ex: 8 * 60 * 60 }   // REVOKE_TTL — 8 hours
    );
  });

  it("completes without error when called for a user with no sessions", async () => {
    const { revokeUserSessions } = await import("@/lib/auth");
    mockRedis.set.mockResolvedValue("OK");

    await expect(revokeUserSessions("user-no-sessions")).resolves.toBeUndefined();
    expect(mockRedis.set).toHaveBeenCalledTimes(1);
  });

  it("propagates Redis errors", async () => {
    const { revokeUserSessions } = await import("@/lib/auth");
    mockRedis.set.mockRejectedValue(new Error("Redis connection refused"));

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
    mockRedis.del.mockResolvedValue(1);

    await restoreUserSessions("user-abc-123");

    expect(mockRedis.del).toHaveBeenCalledWith("revoked:user-abc-123");
  });

  it("propagates Redis errors", async () => {
    const { restoreUserSessions } = await import("@/lib/auth");
    mockRedis.del.mockRejectedValue(new Error("Redis timeout"));

    await expect(restoreUserSessions("user-123")).rejects.toThrow("Redis timeout");
  });
});