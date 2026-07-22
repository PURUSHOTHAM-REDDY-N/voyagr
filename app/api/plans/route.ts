import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId, handleApiError } from "@/lib/api-utils";
import { getSharedPlans } from "@/lib/server/plan";
import { serializePlanSettings } from "@/lib/server/serialize";

export async function GET() {
  try {
    const userId = await requireUserId();
    const [ownPlans, sharedPlans] = await Promise.all([
      db.plan.findMany({ where: { userId } }),
      getSharedPlans(userId),
    ]);

    const sharedPlanIds = sharedPlans.map((p) => p.id);
    const combinedPlans = ownPlans.concat(sharedPlans);

    const data = await Promise.all(
      combinedPlans.map(async (plan) => {
        const planSettings = await db.planSettings.findUnique({ where: { planId: plan.id } });
        return {
          ...serializePlanSettings(planSettings),
          ...plan,
          isSharedPlan: sharedPlanIds.includes(plan.id),
        };
      })
    );

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await req.json();
    const {
      placeName,
      noOfDays,
      activityPreferences,
      fromDate,
      toDate,
      companion,
      isGeneratedUsingAI,
    } = body;

    const state = !isGeneratedUsingAI;

    const newPlan = await db.plan.create({
      data: {
        nameoftheplace: placeName,
        abouttheplace: "",
        adventuresactivitiestodo: [],
        topplacestovisit: [],
        userId,
        userPrompt: `${noOfDays} days trip to ${placeName}`,
        besttimetovisit: "",
        itinerary: [],
        localcuisinerecommendations: [],
        packingchecklist: [],
        isGeneratedUsingAI,
        contentGenerationState: {
          imagination: state,
          abouttheplace: state,
          adventuresactivitiestodo: state,
          besttimetovisit: state,
          itinerary: state,
          localcuisinerecommendations: state,
          packingchecklist: state,
          topplacestovisit: state,
        },
      },
    });

    await db.planSettings.create({
      data: {
        planId: newPlan.id,
        userId,
        activityPreferences: activityPreferences ?? [],
        fromDate: fromDate ? new Date(fromDate) : undefined,
        toDate: toDate ? new Date(toDate) : undefined,
        companion,
        isPublished: false,
      },
    });

    console.log(`createEmptyPlan called by ${userId} on planId : ${newPlan.id}`);
    return NextResponse.json({ planId: newPlan.id });
  } catch (error) {
    return handleApiError(error);
  }
}
