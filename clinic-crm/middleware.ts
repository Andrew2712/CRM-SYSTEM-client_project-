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
 */

import { withAuth } from "next-auth/middleware";
import type { NextRequestWithAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

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

  // Hard fail if secret is not configured — this is a deployment error
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

export default withAuth(
  function middleware(req: NextRequestWithAuth) {
    const { pathname } = req.nextUrl;

    // ── Cron paths: Bearer-token auth, no session needed ──────────────────
    if (isCronPath(pathname)) {
      return handleCronAuth(req);
    }

    if (isPublic(pathname)) return NextResponse.next();

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

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ token, req }) {
        const { pathname } = req.nextUrl;
        if (isPublic(pathname)) return true;
        if (isCronPath(pathname)) return true; // cron auth handled above
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
