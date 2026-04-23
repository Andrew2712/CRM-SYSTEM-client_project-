/**
 * src/app/api/admin/appointments/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/admin/appointments?from=ISO&to=ISO
 *
 * Returns all clinic appointments within a date range.
 * Access: ADMIN only
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  // ─────────────────────────────────────────────────────────────
  // 1️⃣ Auth + Role Guard
  // ─────────────────────────────────────────────────────────────
  let session;
  try {
    session = await requireAuth();
    requireRole(session, ["ADMIN"]);
  } catch (err) {
    return err as NextResponse;
  }

  try {
    // ─────────────────────────────────────────────────────────────
    // 2️⃣ Query Params Validation
    // ─────────────────────────────────────────────────────────────
    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");

    if (!from || !to) {
      return NextResponse.json(
        {
          error:
            "Query params `from` and `to` are required (ISO date strings)",
        },
        { status: 400 }
      );
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    if (fromDate >= toDate) {
      return NextResponse.json(
        { error: "`from` must be earlier than `to`" },
        { status: 400 }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // 3️⃣ Fetch Appointments (Admin = no restriction)
    // ─────────────────────────────────────────────────────────────
    const appointments = await prisma.appointment.findMany({
      where: {
        startTime: {
          gte: fromDate,
          lt: toDate,
        },
      },
      orderBy: { startTime: "asc" },

      include: {
        patient: {
          select: {
            id: true,
            name: true,
            patientCode: true,
            status: true,
            phase: true,
          },
        },
        doctor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // ─────────────────────────────────────────────────────────────
    // 4️⃣ Response
    // ─────────────────────────────────────────────────────────────
    return NextResponse.json({
      count: appointments.length,
      from: fromDate,
      to: toDate,
      data: appointments,
    });
  } catch (error) {
    console.error("Admin appointments error:", error);

    return NextResponse.json(
      { error: "Failed to fetch appointments" },
      { status: 500 }
    );
  }
}