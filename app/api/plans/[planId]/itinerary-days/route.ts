import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId, handleApiError } from "@/lib/api-utils";
import { validatePlanAccess } from "@/lib/server/plan";
import { renumberItineraryDays } from "@/lib/server/itineraryOrdering";

export async function POST(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const userId = await requireUserId();
    const { planId } = params;
    const { itineraryDay } = await req.json();

    const { plan } = await validatePlanAccess(planId, userId);

    const newItinerary = renumberItineraryDays([
      ...plan.itinerary,
      { ...itineraryDay, title: `Day ${plan.itinerary.length + 1}` },
    ]);

    console.log(`addDayInItinerary called by ${userId} on planId : ${planId}`);
    await db.plan.update({
      where: { id: planId },
      data: { itinerary: newItinerary },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
