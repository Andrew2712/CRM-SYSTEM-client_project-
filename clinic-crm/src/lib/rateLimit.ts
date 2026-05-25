/**
 * src/lib/rateLimit.ts
 * Distributed rate limiter using Upstash Redis.
 * Works correctly across all Vercel serverless instances.
 *
 * Set env vars:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *
 * Fallback: if env vars missing, falls back to in-process Map
 * (safe for local dev without Redis).
 */

import { NextRequest, NextResponse } from "next/server";

// ── Types (unchanged — backward compatible) ───────────────────────────────────

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  key: string;
};

// ── IP extraction (unchanged) ─────────────────────────────────────────────────

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ── Redis-backed limiter ──────────────────────────────────────────────────────

async function redisRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const { Redis } = await import("@upstash/redis");
  const { Ratelimit } = await import("@upstash/ratelimit");

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
  });

  const { success, limit, remaining, reset } = await ratelimit.limit(key);
  return { success, limit, remaining, reset: Math.ceil(reset / 1000), key };
}

// ── Fallback in-process limiter ───────────────────────────────────────────────

type WindowEntry = { count: number; resetAt: number };
const store = new Map<string, WindowEntry>();

function localRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  let entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
  } else {
    entry.count++;
  }

  return {
    success: entry.count <= maxRequests,
    limit: maxRequests,
    remaining: Math.max(0, maxRequests - entry.count),
    reset: Math.ceil(entry.resetAt / 1000),
    key,
  };
}

// ── Core function ─────────────────────────────────────────────────────────────

export async function rateLimit(
  req: NextRequest,
  namespace: string,
  maxRequests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const ip = getClientIp(req);
  const key = `rl:${namespace}:${ip}`;

  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    try {
      return await redisRateLimit(key, maxRequests, windowSeconds);
    } catch (err) {
      console.error("[RateLimit] Redis error, falling back to local:", err);
    }
  }

  return localRateLimit(key, maxRequests, windowSeconds);
}

// ── Standard 429 response (unchanged) ────────────────────────────────────────

export function rateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: "Too many requests. Please slow down and try again.",
      retryAfter: result.reset - Math.floor(Date.now() / 1000),
    },
    {
      status: 429,
      headers: {
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.reset),
        "Retry-After": String(result.reset - Math.floor(Date.now() / 1000)),
      },
    }
  );
}

// ── Preset helpers (unchanged signatures) ────────────────────────────────────

export async function rateLimitAuth(req: NextRequest) {
  return rateLimit(req, "auth", 5, 60);
}
export async function rateLimitWrite(req: NextRequest) {
  return rateLimit(req, "write", 30, 60);
}
export async function rateLimitRead(req: NextRequest) {
  return rateLimit(req, "read", 100, 60);
}
export async function rateLimitAdmin(req: NextRequest) {
  return rateLimit(req, "admin", 20, 60);
}
export async function rateLimitExport(req: NextRequest) {
  return rateLimit(req, "export", 10, 60);
}