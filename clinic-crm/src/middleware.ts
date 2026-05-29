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

export default withAuth(
  function middleware(req: NextRequestWithAuth) {
    const { pathname } = req.nextUrl;

    // Generate nonce for every request
    const nonce = generateNonce();

    // ── Cron paths ────────────────────────────────────────────────────────
    if (isCronPath(pathname)) {
      return handleCronAuth(req);
    }

    // ── Build response with nonce-based CSP ───────────────────────────────
    function withNonce(response: NextResponse): NextResponse {
      response.headers.set("x-nonce", nonce);
      response.headers.set("Content-Security-Policy", buildCsp(nonce));
      return response;
    }

    if (isPublic(pathname)) {
      return withNonce(NextResponse.next());
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

    return withNonce(NextResponse.next());
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
