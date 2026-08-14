import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId, handleApiError } from "@/lib/api-utils";
import { generateItineraryDays } from "@/lib/server/generatePlanContent";
import { RankedPoi } from "@/lib/server/recommendationEngine";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const userId = await requireUserId();
    const { planId } = params;
    const { fromDate, toDate } = await req.json();
    console.log(`updateTravelDates called by ${userId} on planId : ${planId}`);

    await db.planSettings.upsert({
      where: { planId },
      update: { fromDate: new Date(fromDate), toDate: new Date(toDate) },
      create: {
        planId,
        userId,
        fromDate: new Date(fromDate),
        toDate: new Date(toDate),
        isPublished: false,
      },
    });

    const plan = await db.plan.findUnique({ where: { id: planId } });

    // Day count, and each day's weather-steered content, are both derived
    // from the trip dates (see generateItineraryDays) - once they change,
    // the existing itinerary no longer matches the trip and has to be
    // rebuilt. Only for AI-authored plans: an empty/manual plan's itinerary
    // is hand-written, so a date edit there must not silently overwrite it.
    if (plan?.isGeneratedUsingAI) {
      await db.plan.update({
        where: { id: planId },
        data: {
          contentGenerationState: {
            update: { itinerary: false, topplacestovisit: false },
          },
        },
      });

      // Fire-and-forget, same as initial generation (kickOffPlanGeneration) -
      // a full itinerary rebuild takes too long to hold the PATCH response
      // open for. The client already polls while contentGenerationState has
      // any false flag (see usePlan.ts), so flipping it above is enough for
      // the UI to pick up the result once this finishes.
      const recommendedPoiNames = plan.recommendedPois.map((poi) => poi.name);
      generateItineraryDays(planId, recommendedPoiNames, undefined, plan.recommendedPois as RankedPoi[]).catch((e) =>
        console.error(`generateItineraryDays failed for ${planId} after a date change`, e)
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
