import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId, handleApiError } from "@/lib/api-utils";
import { validatePlanAccess } from "@/lib/server/plan";
import { notifyExpenseParticipants } from "@/lib/server/expenseNotifications";

async function getName(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return "Anonymous User";
  return user.firstName ? user.firstName + (user.lastName ? ` ${user.lastName}` : "") : user.email;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const userId = await requireUserId();
    const { planId } = params;
    await validatePlanAccess(planId, userId);

    const expenses = await db.expense.findMany({
      where: { planId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const data = await Promise.all(
      expenses.map(async (expense) => ({
        ...expense,
        whoSpent: await getName(expense.userId),
      }))
    );

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const callerId = await requireUserId();
    const { planId } = params;
    await validatePlanAccess(planId, callerId);
    const { userId, amount, purpose, category, date, splits } = await req.json();

    console.log(`${callerId} Created Expense for ${userId} | ${planId}`);
    const expense = await db.expense.create({
      data: { planId, userId, amount, purpose, category, date, splits: splits ?? [] },
    });

    if (splits && splits.length > 0) {
      await notifyExpenseParticipants({
        planId,
        purpose,
        amount,
        paidByUserId: userId,
        splits,
        actingUserId: callerId,
      });
    }

    return NextResponse.json(expense);
  } catch (error) {
    return handleApiError(error);
  }
}
