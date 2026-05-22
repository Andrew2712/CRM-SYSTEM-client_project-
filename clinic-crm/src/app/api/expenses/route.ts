/**
 * src/app/api/expenses/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * GET  /api/expenses  — list expenses (pagination + search + filters)
 * POST /api/expenses  — create expense
 *
 * Access: ADMIN, RECEPTIONIST only (DOCTOR is blocked)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/rbac";
import { ExpenseCategory, PaymentMode } from "@prisma/client";

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    return err as NextResponse;
  }

  try {
    requireRole(session, ["ADMIN", "RECEPTIONIST"]);
  } catch (err) {
    return err as NextResponse;
  }

  const { searchParams } = req.nextUrl;
  const search      = searchParams.get("search") ?? "";
  const category    = searchParams.get("category") ?? "";
  const paymentMode = searchParams.get("paymentMode") ?? "";
  const dateFrom    = searchParams.get("dateFrom") ?? "";
  const dateTo      = searchParams.get("dateTo") ?? "";
  const page        = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit       = Math.min(100, parseInt(searchParams.get("limit") ?? "20", 10));
  const skip        = (page - 1) * limit;

  try {
    const where: Record<string, unknown> = {
      isDeleted: false,
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }
    if (category && Object.values(ExpenseCategory).includes(category as ExpenseCategory)) {
      where.category = category as ExpenseCategory;
    }
    if (paymentMode && Object.values(PaymentMode).includes(paymentMode as PaymentMode)) {
      where.paymentMode = paymentMode as PaymentMode;
    }
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      where.expenseDate = dateFilter;
    }

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true, role: true } },
        },
        orderBy: { expenseDate: "desc" },
        skip,
        take: limit,
      }),
      prisma.expense.count({ where }),
    ]);

    return NextResponse.json({
      expenses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/expenses error:", error);
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    return err as NextResponse;
  }

  try {
    requireRole(session, ["ADMIN", "RECEPTIONIST"]);
  } catch (err) {
    return err as NextResponse;
  }

  try {
    const body = await req.json();
    const { title, description, category, amount, expenseDate, paymentMode } = body;

    // ── Validation ──
    const errors: string[] = [];
    if (!title?.trim())                                                         errors.push("Title is required");
    if (title?.trim().length > 200)                                             errors.push("Title must be under 200 characters");
    if (!category || !Object.values(ExpenseCategory).includes(category))        errors.push("Valid category is required");
    if (!paymentMode || !Object.values(PaymentMode).includes(paymentMode))      errors.push("Valid payment mode is required");
    if (amount === undefined || amount === null || isNaN(Number(amount)))        errors.push("Amount is required");
    if (Number(amount) <= 0)                                                    errors.push("Amount must be greater than 0");
    if (!expenseDate)                                                            errors.push("Expense date is required");
    if (expenseDate && isNaN(new Date(expenseDate).getTime()))                  errors.push("Invalid expense date");

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
    }

    const expense = await prisma.expense.create({
      data: {
        title:       title.trim(),
        description: description?.trim() || null,
        category:    category as ExpenseCategory,
        amount:      parseFloat(amount),
        expenseDate: new Date(expenseDate),
        paymentMode: paymentMode as PaymentMode,
        createdById: session.user.id,
      },
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("POST /api/expenses error:", error);
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}
