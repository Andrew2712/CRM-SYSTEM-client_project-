import { withAuth } from "next-auth/middleware";
import type { NextRequestWithAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// ── Public paths — no session required ───────────────────────────────────────
const PUBLIC_PATHS: RegExp[] = [
  /^\/$/,
  /^\/auth\/.*/,
  /^\/api\/auth\/.*/,
  /^\/api\/cron\/.*/,
  /^\/api\/health$/,
  /^\/_next\/.*/,
  /^\/favicon\.ico$/,
  /^\/logo\.png$/,
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((re) => re.test(pathname));
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

    if (isPublic(pathname)) return NextResponse.next();

    const token = req.nextauth.token;

    if (!token) {
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }

    // Safely cast custom fields from JWT
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