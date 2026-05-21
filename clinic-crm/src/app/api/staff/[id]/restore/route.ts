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

    const restored = await prisma.user.update({
      where: { id },
      data: {
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      message: `Staff member "${restored.name}" has been reactivated.`,
      user: restored,
    });

  } catch (error) {

    console.error(
      "PATCH /staff/[id]/restore error:",
      error
    );

    return NextResponse.json(
      { error: "Failed to reactivate staff member" },
      { status: 500 }
    );
  }
}
