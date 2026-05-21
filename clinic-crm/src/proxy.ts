/**
 * src/proxy.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Route protection:
 *   - /dashboard/* → Staff only (ADMIN, DOCTOR, RECEPTIONIST)
 *   - /patient/*   → PATIENT role only
 *   - Unauthenticated → /auth/login
 */

import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const role =
    req.nextauth.token?.role as
      | "ADMIN"
      | "DOCTOR"
      | "RECEPTIONIST"
      | "PATIENT"
      | undefined;

  // Patient trying to enter staff dashboard
  if (
    pathname.startsWith("/dashboard") &&
    role === "PATIENT"
  ) {
    return NextResponse.redirect(
      new URL("/patient/dashboard", req.url)
    );
  }

  // Staff trying to enter patient portal
  if (
    pathname.startsWith("/patient") &&
    role &&
    role !== "PATIENT"
  ) {

    const staffDestinations = {
      ADMIN: "/dashboard",
      DOCTOR: "/dashboard/doctor",
      RECEPTIONIST: "/dashboard/booking",
    };

    return NextResponse.redirect(
      new URL(
        staffDestinations[role] ??
          "/dashboard",
        req.url
      )
    );
  }

  return NextResponse.next();
}

export default withAuth(proxy, {

  callbacks: {

    authorized: ({ token }) => {
      return !!token;
    },

  },

  pages: {

    signIn: "/auth/login",

  },

});

export const config = {

  matcher: [
    "/dashboard/:path*",
    "/patient/:path*",
  ],

};
