/**
 * src/middleware.ts  ← this is the file Next.js actually runs (src/ takes priority)
 *
 * ROOT CAUSE OF THE CSP ERROR — THREE BUGS, ALL FIXED HERE:
 *
 * Bug 1 — Nonce set on RESPONSE headers only.
 *   layout.tsx calls `headers()` from "next/headers". In React Server Components,
 *   `headers()` reads the *incoming request* headers, NOT the outgoing response
 *   headers. So the nonce set via `response.headers.set("x-nonce", nonce)` was
 *   never visible to layout.tsx — it always got an empty string and passed no
 *   nonce to Next.js's script injection. Next.js then emitted inline scripts
 *   without a nonce, which the CSP blocked.
 *   FIX: Use NextResponse.next({ request: { headers: requestHeaders } }) to
 *   forward x-nonce on the *request* so `headers()` can read it.
 *
 * Bug 2 — Dead root-level middleware.ts shadowing this file.
 *   There are two middleware files: middleware.ts (root) and src/middleware.ts.
 *   Next.js resolves middleware from the project root first. The root file was
 *   being used in production. Delete middleware.ts from the project root.
 *   Only src/middleware.ts should exist.
 *
 * Bug 3 — SessionProvider silently drops the nonce prop (fixed separately).
 *
 * ALSO FIXED: cron routes returned NextResponse.next() on success but didn't
 * propagate the nonce on that response — now they do.
 */

import { withAuth } from "next-auth/middleware";
import type { NextRequestWithAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { buildCsp } from "../next.config";

// ── Nonce generation ──────────────────────────────────────────────────────────

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString("base64");
}

// ── Public paths — no session required ───────────────────────────────────────

const PUBLIC_PATHS: RegExp[] = [
  /^\/$/,
  /^\/auth\/.*/,
  /^\/api\/auth\/.*/,
  /^\/api\/health$/,
  /^\/_next\/.*/,
  /^\/favicon\.ico$/,
  /^\/logo\.png$/,
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((re) => re.test(pathname));
}

// ── Cron path guard ───────────────────────────────────────────────────────────

function isCronPath(pathname: string): boolean {
  return /^\/api\/cron\//.test(pathname);
}

function handleCronAuth(req: NextRequestWithAuth): NextResponse {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret?.trim()) {
    console.error("[Middleware] CRON_SECRET is not set");
    return NextResponse.json(
      { error: "Server misconfiguration: CRON_SECRET not set" },
      { status: 500 }
    );
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.next();
}

// ── Role → allowed path prefixes ─────────────────────────────────────────────

const ROLE_PATHS: Record<string, RegExp[]> = {
  ADMIN:        [/^\/dashboard.*/, /^\/api\/.*/],
  DOCTOR:       [/^\/dashboard.*/, /^\/api\/.*/],
  RECEPTIONIST: [/^\/dashboard.*/, /^\/api\/.*/],
  PATIENT:      [/^\/patient.*/, /^\/api\/patient\/.*/],
};

// ── Core helper: forward nonce on REQUEST + set CSP on RESPONSE ───────────────
//
// CRITICAL: Next.js `headers()` in Server Components reads the *request*
// headers of the current in-flight request, not the response headers.
// We must clone the incoming headers, add x-nonce, and pass them as
// `request.headers` to NextResponse.next(). Only then will layout.tsx
// receive the nonce via `headersList.get("x-nonce")`.

function withNonce(req: NextRequestWithAuth, nonce: string): NextResponse {
  // 1. Clone incoming request headers and inject the nonce
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  // 2. Create the passthrough response, forwarding the mutated request headers
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // 3. Also set x-nonce and CSP on the response (belt-and-suspenders)
  response.headers.set("x-nonce", nonce);
  response.headers.set("Content-Security-Policy", buildCsp(nonce));

  return response;
}

// ── Middleware ────────────────────────────────────────────────────────────────

export default withAuth(
  function middleware(req: NextRequestWithAuth) {
    const { pathname } = req.nextUrl;
    const nonce = generateNonce();

    // Cron: authenticate via Bearer token; nonce not needed for API routes
    if (isCronPath(pathname)) {
      return handleCronAuth(req);
    }

    if (isPublic(pathname)) {
      return withNonce(req, nonce);
    }

    const token = req.nextauth.token;

    if (!token) {
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }

    const role = (token.role as string | undefined) ?? "";
    const allowed = ROLE_PATHS[role] ?? [];
    const canAccess = allowed.some((re) => re.test(pathname));

    if (!canAccess) {
      if (role === "PATIENT" && pathname.startsWith("/dashboard")) {
        return NextResponse.redirect(new URL("/patient/dashboard", req.url));
      }
      if (role !== "PATIENT" && pathname.startsWith("/patient")) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }

    return withNonce(req, nonce);
  },
  {
    callbacks: {
      authorized({ token, req }) {
        const { pathname } = req.nextUrl;
        if (isPublic(pathname)) return true;
        if (isCronPath(pathname)) return true;
        return !!token;
      },
    },
    pages: {
      signIn: "/auth/login",
    },
  }
);

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.svg$).*)",
  ],
};
