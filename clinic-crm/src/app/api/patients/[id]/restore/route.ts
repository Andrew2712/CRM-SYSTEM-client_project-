import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/rbac";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;

  try {
    session = await requireAuth();
    requireRole(session, ["ADMIN"]);
  } catch (err) {
    return err as NextResponse;
  }

  try {
    // Next.js 16 fix
    const { id } = await params;

    const restored = await prisma.patient.update({
      where: { id },
      data: {
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      message: `Patient "${restored.name}" has been reactivated.`,
      patient: restored,
    });

  } catch (error) {

    console.error(
      "PATCH /patients/[id]/restore error:",
      error
    );

    return NextResponse.json(
      { error: "Failed to reactivate patient" },
      { status: 500 }
    );
  }
}
