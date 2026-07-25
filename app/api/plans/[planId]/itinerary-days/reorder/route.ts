import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId, handleApiError, ApiError } from "@/lib/api-utils";
import { validatePlanAccess } from "@/lib/server/plan";
import { moveItineraryDay } from "@/lib/server/itineraryOrdering";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const userId = await requireUserId();
    const { planId } = params;
    const { fromIndex, toIndex } = await req.json();

    if (typeof fromIndex !== "number" || typeof toIndex !== "number") {
      throw new ApiError("fromIndex and toIndex must be numbers", 400);
    }

    const { plan } = await validatePlanAccess(planId, userId);

    let reordered;
    try {
      reordered = moveItineraryDay(plan.itinerary, fromIndex, toIndex);
    } catch (error) {
      throw new ApiError(error instanceof Error ? error.message : "Invalid reorder request", 400);
    }

    console.log(`reorderItineraryDay called by ${userId} on planId : ${planId}, ${fromIndex} -> ${toIndex}`);
    await db.plan.update({
      where: { id: planId },
      data: { itinerary: reordered },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
