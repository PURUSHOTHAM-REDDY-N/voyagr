import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId, handleApiError } from "@/lib/api-utils";
import { validatePlanAccess } from "@/lib/server/plan";

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const { ids } = await req.json();

    const expenses = await db.expense.findMany({ where: { id: { in: ids } } });
    const planIds = [...new Set(expenses.map((e) => e.planId))];
    await Promise.all(planIds.map((planId) => validatePlanAccess(planId, userId)));

    console.log(`${userId} deleted expenses ${ids.toString()}`);
    await db.expense.deleteMany({ where: { id: { in: ids } } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
