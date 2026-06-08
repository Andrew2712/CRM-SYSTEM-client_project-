/**
 * src/app/api/assessments/[id]/route.ts
 *
 * GET    /api/assessments/[id]           — Get full assessment (doctor/admin)
 * PATCH  /api/assessments/[id]           — Update status (e.g. publish/archive)
 * DELETE /api/assessments/[id]           — Soft-archive
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";


// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    requireRole(session, ["DOCTOR", "ADMIN", "RECEPTIONIST"]);

    const assessment = await prisma.patientAssessment.findUnique({
      where: { id: params.id },
      include: {
        patient: { select: { name: true, patientCode: true, age: true, gender: true, phone: true } },
        doctor: { select: { name: true, email: true } },
      },
    });

    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    // DOCTOR can only access their own assessments
    if (session.user.role === "DOCTOR" && assessment.doctorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ assessment });
  } catch (err) {
    if (err instanceof NextResponse) throw err;
    logger.error(`GET /api/assessments/[id] failed: ${err instanceof Error ? err.message : String(err)}`);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── PATCH — Update status ────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    requireRole(session, ["DOCTOR", "ADMIN"]);

    const body = await req.json();
    const { status } = body;

    if (!["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const existing = await prisma.patientAssessment.findUnique({
      where: { id: params.id },
      select: { doctorId: true, patientId: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    if (session.user.role === "DOCTOR" && existing.doctorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await prisma.patientAssessment.update({
      where: { id: params.id },
      data: {
        status: status as "DRAFT" | "PUBLISHED" | "ARCHIVED",
        publishedAt: status === "PUBLISHED" ? new Date() : undefined,
      },
    });

    // Notify patient if publishing
    if (status === "PUBLISHED" && existing.status !== "PUBLISHED") {
      const patient = await prisma.patient.findUnique({
        where: { id: existing.patientId },
        select: { passwordHash: true },
      });
      if (patient?.passwordHash) {
        await prisma.inAppNotification.create({
          data: {
            userId: existing.patientId,
            type: "ASSESSMENT_PUBLISHED" as any,
            title: "Your Assessment Report is Ready",
            body: "Your physiotherapy assessment report has been published. You can now view and download it from your dashboard.",
            entityId: params.id,
          },
        }).catch(() => {});
      }
    }

    await auditLog({
      session,
      req,
      action: "UPDATE",
      entity: "PatientAssessment",
      entityId: params.id,
      description: `Assessment status changed to ${status}`,
      oldValue: { status: existing.status },
      newValue: { status },
    });

    return NextResponse.json({ assessment: updated });
  } catch (err) {
    if (err instanceof NextResponse) throw err;
    logger.error(`PATCH /api/assessments/[id] failed: ${err instanceof Error ? err.message : String(err)}`);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── DELETE — Archive ─────────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    requireRole(session, ["DOCTOR", "ADMIN"]);

    const existing = await prisma.patientAssessment.findUnique({
      where: { id: params.id },
      select: { doctorId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    if (session.user.role === "DOCTOR" && existing.doctorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Soft-archive instead of hard delete
    await prisma.patientAssessment.update({
      where: { id: params.id },
      data: { status: "ARCHIVED" },
    });

    await auditLog({
      session,
      req,
      action: "DELETE",
      entity: "PatientAssessment",
      entityId: params.id,
      description: "Assessment archived",
    });

    return NextResponse.json({ message: "Assessment archived" });
  } catch (err) {
    if (err instanceof NextResponse) throw err;
    logger.error(`DELETE /api/assessments/[id] failed: ${err instanceof Error ? err.message : String(err)}`);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}