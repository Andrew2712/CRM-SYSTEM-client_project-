/**
 * src/middleware.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Route protection middleware:
 *   - /dashboard/* → Staff only (ADMIN, DOCTOR, RECEPTIONIST)
 *   - /patient/*   → PATIENT role only
 *   - Unauthenticated requests redirect to /auth/login
 */

import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role as string | undefined;

    // ── Patient tries to access staff dashboard ────────────────────────────
    if (pathname.startsWith("/dashboard") && role === "PATIENT") {
      return NextResponse.redirect(new URL("/patient/dashboard", req.url));
    }

    // ── Staff tries to access patient portal ──────────────────────────────
    if (
      pathname.startsWith("/patient") &&
      role &&
      role !== "PATIENT"
    ) {
      const staffDestinations: Record<string, string> = {
        ADMIN:        "/dashboard",
        DOCTOR:       "/dashboard/doctor",
        RECEPTIONIST: "/dashboard/booking",
      };
      return NextResponse.redirect(
        new URL(staffDestinations[role] ?? "/dashboard", req.url)
      );
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Let the middleware function above handle role logic;
      // withAuth will redirect to /auth/login if no token.
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*", "/patient/:path*"],
};
