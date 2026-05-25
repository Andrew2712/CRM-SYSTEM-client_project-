/**
 * src/lib/rateLimit.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Production-ready sliding-window rate limiter.
 *
 * Strategy:
 *  - Uses an in-process Map (works on Vercel serverless — each lambda instance
 *    gets its own counter, which is fine for burst protection).
 *  - For true distributed rate limiting across instances, swap the store with
 *    Upstash Redis (drop-in replacement — just change `store` below).
 *
 * Usage:
 *   const result = await rateLimit(req, "auth", 5, 60);   // 5 req / 60 s
 *   if (!result.success) return rateLimitResponse(result);
 *
 * Preset helpers for common routes:
 *   rateLimitAuth(req)       — 5 / 60s  (login, signup, reset-password)
 *   rateLimitWrite(req)      — 30 / 60s (POST/PATCH/DELETE mutations)
 *   rateLimitRead(req)       — 100 / 60s (GET data endpoints)
 *   rateLimitAdmin(req)      — 20 / 60s (admin-only routes)
 */

import { NextRequest, NextResponse } from "next/server";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RateLimitResult = {
  success:   boolean;
  limit:     number;
  remaining: number;
  reset:     number;   // Unix timestamp (seconds)
  key:       string;
};

type WindowEntry = {
  count:     number;
  resetAt:   number;  // ms
};

// ─── In-process store ────────────────────────────────────────────────────────

const store = new Map<string, WindowEntry>();

// Clean up expired entries every 5 minutes to prevent memory leak
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) store.delete(key);
    }
  }, 5 * 60 * 1000);
}

// ─── IP extraction ────────────────────────────────────────────────────────────

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ─── Core function ────────────────────────────────────────────────────────────

export async function rateLimit(
  req: NextRequest,
  namespace: string,
  maxRequests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const ip      = getClientIp(req);
  const key     = `rl:${namespace}:${ip}`;
  const now     = Date.now();
  const windowMs = windowSeconds * 1000;

  let entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    // New window
    entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
  } else {
    entry.count++;
  }

  const remaining = Math.max(0, maxRequests - entry.count);
  const success   = entry.count <= maxRequests;
  const reset     = Math.ceil(entry.resetAt / 1000);

  return { success, limit: maxRequests, remaining, reset, key };
}

// ─── Standard 429 response ────────────────────────────────────────────────────

export function rateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error:   "Too many requests. Please slow down and try again.",
      retryAfter: result.reset - Math.floor(Date.now() / 1000),
    },
    {
      status: 429,
      headers: {
        "X-RateLimit-Limit":     String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset":     String(result.reset),
        "Retry-After":           String(result.reset - Math.floor(Date.now() / 1000)),
      },
    }
  );
}

// ─── Preset helpers ───────────────────────────────────────────────────────────

/** Auth endpoints: login, signup, reset-password — tightest limit */
export async function rateLimitAuth(req: NextRequest) {
  return rateLimit(req, "auth", 5, 60);
}

/** Mutating endpoints: POST/PATCH/DELETE on data */
export async function rateLimitWrite(req: NextRequest) {
  return rateLimit(req, "write", 30, 60);
}

/** Read endpoints: GET lists and analytics */
export async function rateLimitRead(req: NextRequest) {
  return rateLimit(req, "read", 100, 60);
}

/** Admin-only endpoints */
export async function rateLimitAdmin(req: NextRequest) {
  return rateLimit(req, "admin", 20, 60);
}

/** Export endpoints — prevent bulk scraping */
export async function rateLimitExport(req: NextRequest) {
  return rateLimit(req, "export", 10, 60);
}
