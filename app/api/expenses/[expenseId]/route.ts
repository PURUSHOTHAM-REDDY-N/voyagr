import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId, handleApiError, ApiError } from "@/lib/api-utils";
import { validatePlanAccess } from "@/lib/server/plan";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { expenseId: string } }
) {
  try {
    const userId = await requireUserId();
    const { expenseId } = params;

    const existing = await db.expense.findUnique({ where: { id: expenseId } });
    if (!existing) {
      throw new ApiError("Expense not found", 404);
    }
    await validatePlanAccess(existing.planId, userId);

    const { amount, purpose, category, date, userId: spentByUserId, splits } = await req.json();

    console.log(`${userId} patched Expense for expense id ${expenseId}`);
    const expense = await db.expense.update({
      where: { id: expenseId },
      data: { amount, purpose, category, date, userId: spentByUserId, splits: splits ?? [] },
    });

    return NextResponse.json(expense);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { expenseId: string } }
) {
  try {
    const userId = await requireUserId();

    const existing = await db.expense.findUnique({ where: { id: params.expenseId } });
    if (!existing) {
      throw new ApiError("Expense not found", 404);
    }
    await validatePlanAccess(existing.planId, userId);

    console.log(`${userId} Deleted Expense for expense ID ${params.expenseId}`);
    await db.expense.delete({ where: { id: params.expenseId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
