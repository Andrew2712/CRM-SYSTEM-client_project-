/**
 * src/app/api/expenses/[id]/route.ts
 * GET / PATCH / DELETE — ADMIN only for mutations
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/rbac";
import { ExpenseCategory, PaymentMode } from "@prisma/client";
import { rateLimitRead, rateLimitWrite, rateLimitResponse } from "@/lib/rateLimit";
import { auditExpense } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const rl = await rateLimitRead(_req);
  if (!rl.success) return rateLimitResponse(rl);

  let session;
  try { session = await requireAuth(); } catch (err) { return err as NextResponse; }
  try { requireRole(session, ["ADMIN", "RECEPTIONIST"]); } catch (err) { return err as NextResponse; }

  const { id } = await params;
  try {
    const expense = await prisma.expense.findFirst({
      where: { id, isDeleted: false },
      include: { createdBy: { select: { id: true, name: true, role: true } } },
    });
    if (!expense) return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    return NextResponse.json(expense);
  } catch (error) {
    console.error("GET /api/expenses/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch expense" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const rl = await rateLimitWrite(req);
  if (!rl.success) return rateLimitResponse(rl);

  let session;
  try { session = await requireAuth(); } catch (err) { return err as NextResponse; }
  try { requireRole(session, ["ADMIN"]); } catch (err) { return err as NextResponse; }

  const { id } = await params;
  try {
    const existing = await prisma.expense.findFirst({ where: { id, isDeleted: false } });
    if (!existing) return NextResponse.json({ error: "Expense not found" }, { status: 404 });

    const body = await req.json();
    const { title, description, category, amount, expenseDate, paymentMode } = body;

    const errors: string[] = [];
    if (title       !== undefined && !title?.trim())                                       errors.push("Title cannot be empty");
    if (title       !== undefined && title?.trim().length > 200)                           errors.push("Title must be under 200 characters");
    if (category    !== undefined && !Object.values(ExpenseCategory).includes(category))   errors.push("Invalid category");
    if (paymentMode !== undefined && !Object.values(PaymentMode).includes(paymentMode))    errors.push("Invalid payment mode");
    if (amount      !== undefined && (isNaN(Number(amount)) || Number(amount) <= 0))       errors.push("Amount must be greater than 0");
    if (expenseDate !== undefined && isNaN(new Date(expenseDate).getTime()))               errors.push("Invalid expense date");
    if (errors.length > 0) return NextResponse.json({ error: errors.join("; ") }, { status: 400 });

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        ...(title       !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(category    !== undefined && { category: category as ExpenseCategory }),
        ...(amount      !== undefined && { amount: parseFloat(amount) }),
        ...(expenseDate !== undefined && { expenseDate: new Date(expenseDate) }),
        ...(paymentMode !== undefined && { paymentMode: paymentMode as PaymentMode }),
      },
      include: { createdBy: { select: { id: true, name: true, role: true } } },
    });

    await auditExpense(session, req, "UPDATE", id, {
      title: updated.title,
      old: { title: existing.title, amount: existing.amount, category: existing.category },
      new: body,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/expenses/[id] error:", error);
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const rl = await rateLimitWrite(_req);
  if (!rl.success) return rateLimitResponse(rl);

  let session;
  try { session = await requireAuth(); } catch (err) { return err as NextResponse; }
  try { requireRole(session, ["ADMIN"]); } catch (err) { return err as NextResponse; }

  const { id } = await params;
  try {
    const existing = await prisma.expense.findFirst({ where: { id, isDeleted: false } });
    if (!existing) return NextResponse.json({ error: "Expense not found" }, { status: 404 });

    await prisma.expense.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date() } });

    await auditExpense(session, _req, "DELETE", id, { title: existing.title, amount: existing.amount });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/expenses/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}
