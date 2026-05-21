/**
 * src/proxy.ts
 */

import { withAuth, type NextRequestWithAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

function proxy(req: NextRequestWithAuth) {
  const { pathname } = req.nextUrl;

  const role = req.nextauth.token?.role as
    | "ADMIN"
    | "DOCTOR"
    | "RECEPTIONIST"
    | "PATIENT"
    | undefined;

  if (pathname.startsWith("/dashboard") && role === "PATIENT") {
    return NextResponse.redirect(new URL("/patient/dashboard", req.url));
  }

  if (pathname.startsWith("/patient") && role && role !== "PATIENT") {
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
}

export default withAuth(proxy, {
  callbacks: {
    authorized: ({ token }) => !!token,
  },
  pages: {
    signIn: "/auth/login",
  },
});

export const config = {
  matcher: ["/dashboard/:path*", "/patient/:path*"],
};
