import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId, handleApiError } from "@/lib/api-utils";
import { validatePlanAccess } from "@/lib/server/plan";
import { renumberItineraryDays } from "@/lib/server/itineraryOrdering";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { planId: string; dayName: string } }
) {
  try {
    const userId = await requireUserId();
    const { planId, dayName } = params;

    const { plan } = await validatePlanAccess(planId, userId);

    // Renumber the remaining days so "Day N" always matches array position -
    // deleting Day 3 from a 5-day trip leaves Day 1, 2, 3, 4, not 1, 2, 4, 5.
    const remaining = renumberItineraryDays(plan.itinerary.filter((d) => d.title !== dayName));

    console.log(`deleteDayInItinerary called by ${userId} on planId : ${planId}`);
    await db.plan.update({
      where: { id: planId },
      data: { itinerary: remaining },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
