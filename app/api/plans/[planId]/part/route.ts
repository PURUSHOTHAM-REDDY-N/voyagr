import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId, handleApiError } from "@/lib/api-utils";
import { validatePlanAccess } from "@/lib/server/plan";

const ALLOWED_KEYS = [
  "abouttheplace",
  "besttimetovisit",
  "packingchecklist",
  "localcuisinerecommendations",
  "adventuresactivitiestodo",
  "topplacestovisit",
] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const userId = await requireUserId();
    const { planId } = params;
    const { key, data } = await req.json();

    if (!ALLOWED_KEYS.includes(key)) {
      return NextResponse.json({ message: "Invalid key" }, { status: 400 });
    }

    await validatePlanAccess(planId, userId);

    console.log(`updatePartOfPlan called by ${userId} on planId : ${planId}`);
    await db.plan.update({ where: { id: planId }, data: { [key]: data } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
