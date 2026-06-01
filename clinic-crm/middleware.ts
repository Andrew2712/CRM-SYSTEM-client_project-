/**
 * middleware.ts
 *
 * PRODUCTION FIX: /api/cron/* routes were in the PUBLIC_PATHS list, meaning
 * the only protection was the CRON_SECRET bearer token checked inside each
 * handler. If CRON_SECRET was accidentally missing from env, all cron routes
 * were completely open.
 *
 * Fix:
 *  1. Removed /api/cron/* from PUBLIC_PATHS.
 *  2. Added a dedicated cron-path handler that validates the Bearer token
 *     right here in middleware — before the request ever reaches a route.
 *  3. If CRON_SECRET is unset the middleware returns 500 (misconfiguration),
 *     not 401, so the ops team knows immediately something is wrong with env.
 *
 * CSP NONCE FIX:
 *  4. Generate a per-request nonce here.
 *  5. Forward it to the app via the `x-nonce` REQUEST header so layout.tsx
 *     can pass it to <SessionProvider> and any scripts that need it.
 *  6. Set the Content-Security-Policy RESPONSE header here with the nonce,
 *     replacing the broken static CSP that was set in next.config.ts.
 */

import { withAuth } from "next-auth/middleware";
import type { NextRequestWithAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const isDev = process.env.NODE_ENV !== "production";
const PROD_DOMAIN = process.env.NEXT_PUBLIC_APP_URL ?? "https://your-app.vercel.app";

function buildCspWithNonce(nonce: string): string {
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-eval' 'unsafe-inline'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;

  return [
    `default-src 'self'`,
    scriptSrc,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self' ${PROD_DOMAIN} https://*.vercel.app`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");
}

// ── Public paths — no session required ───────────────────────────────────────
const PUBLIC_PATHS: RegExp[] = [
  /^\/$/,
  /^\/auth\/.*/,
  /^\/api\/auth\/.*/,
  // NOTE: /api/cron/* intentionally removed — handled separately below
  /^\/api\/health$/,
  /^\/_next\/.*/,
  /^\/favicon\.ico$/,
  /^\/logo\.png$/,
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((re) => re.test(pathname));
}

// ── Cron path guard — Bearer token, not session ───────────────────────────────
function isCronPath(pathname: string): boolean {
  return /^\/api\/cron\//.test(pathname);
}

function handleCronAuth(req: NextRequestWithAuth): NextResponse {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret?.trim()) {
    console.error("[Middleware] CRON_SECRET is not set — rejecting cron request");
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

// ── Helper: attach nonce to request headers & CSP to response headers ─────────
function attachNonce(
  req: NextRequestWithAuth,
  response: NextResponse,
  nonce: string
): NextResponse {
  // Forward nonce to the app (read by layout.tsx via `headers()`)
  response.headers.set("x-nonce", nonce);
  // Set the per-request CSP on the response
  response.headers.set("Content-Security-Policy", buildCspWithNonce(nonce));
  return response;
}

export default withAuth(
  function middleware(req: NextRequestWithAuth) {
    const { pathname } = req.nextUrl;

    // Generate a cryptographically random nonce for this request
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

    // ── Cron paths: Bearer-token auth, no session needed ──────────────────
    if (isCronPath(pathname)) {
      const cronResponse = handleCronAuth(req);
      return attachNonce(req, cronResponse, nonce);
    }

    if (isPublic(pathname)) {
      return attachNonce(req, NextResponse.next(), nonce);
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

    return attachNonce(req, NextResponse.next(), nonce);
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