import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId, handleApiError, ApiError } from "@/lib/api-utils";
import { validatePlanAccess } from "@/lib/server/plan";
import { serializePlanSettings } from "@/lib/server/serialize";
import { deleteImage } from "@/lib/s3";

export async function GET(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const isPublic = req.nextUrl.searchParams.get("isPublic") === "true";
    const { planId } = params;

    if (!isPublic) {
      const userId = await requireUserId();
      const { plan, isPlanAdmin } = await validatePlanAccess(planId, userId);
      const planSettings = await db.planSettings.findUnique({ where: { planId: plan.id } });

      return NextResponse.json({
        activityPreferences: planSettings?.activityPreferences ?? [],
        ...serializePlanSettings(planSettings),
        companion: planSettings?.companion,
        isPublished: planSettings?.isPublished ?? false,
        ...plan,
        isSharedPlan: !isPlanAdmin,
      });
    }

    const plan = await db.plan.findUnique({ where: { id: planId } });
    const planSettings = await db.planSettings.findUnique({ where: { planId } });
    if (!plan || !planSettings || !planSettings.isPublished) {
      throw new ApiError("Plan not found or not public", 404);
    }

    return NextResponse.json({
      activityPreferences: planSettings?.activityPreferences ?? [],
      ...serializePlanSettings(planSettings),
      companion: planSettings?.companion,
      isPublished: true,
      ...plan,
      isSharedPlan: false,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const userId = await requireUserId();
    const { planId } = params;

    const plan = await db.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new ApiError("There is no such plan to delete with the given Id", 404);
    }
    if (plan.userId !== userId) {
      throw new ApiError("You are not the owner of this plan.", 403);
    }

    if (plan.imageKey) {
      try {
        await deleteImage(plan.imageKey);
      } catch (e) {
        console.log(e);
      }
    }

    await db.expense.deleteMany({ where: { planId } });
    await db.access.deleteMany({ where: { planId } });
    await db.invite.deleteMany({ where: { planId } });
    await db.planSettings.deleteMany({ where: { planId } });
    await db.plan.delete({ where: { id: planId } });

    console.log(`deletePlan called by ${userId} on planId : ${planId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
