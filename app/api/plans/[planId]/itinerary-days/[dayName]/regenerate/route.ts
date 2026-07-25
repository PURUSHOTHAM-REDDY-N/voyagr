import { NextRequest, NextResponse } from "next/server";
import { requireUserId, handleApiError, ApiError } from "@/lib/api-utils";
import { validatePlanAccess } from "@/lib/server/plan";
import { regenerateItineraryDay } from "@/lib/server/generatePlanContent";

/**
 * Regenerates one itinerary day - "the plan was made before the forecast
 * existed, revisit the page and the weather doesn't suit this day, fix just
 * this day without touching the rest." Synchronous (single day takes ~35-45s,
 * see the chunking notes in generatePlanContent.ts), not fire-and-forget: the
 * caller is actively waiting on this one action, unlike initial generation.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { planId: string; dayName: string } }
) {
  try {
    const userId = await requireUserId();
    const { planId, dayName: dayTitle } = params;

    const { plan } = await validatePlanAccess(planId, userId);
    if (!plan.itinerary.some((day) => day.title === dayTitle)) {
      throw new ApiError(`No itinerary day titled "${dayTitle}"`, 404);
    }

    const day = await regenerateItineraryDay(planId, dayTitle);
    return NextResponse.json({ day });
  } catch (error) {
    return handleApiError(error);
  }
}
