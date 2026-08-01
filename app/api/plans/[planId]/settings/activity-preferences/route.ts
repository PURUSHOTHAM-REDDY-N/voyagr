import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId, handleApiError } from "@/lib/api-utils";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const userId = await requireUserId();
    const { planId } = params;
    const { activityPreferencesIds } = await req.json();
    console.log(
      `updateActivityPreferences called by ${userId} with ${activityPreferencesIds.toString()}`
    );

    await db.planSettings.upsert({
      where: { planId },
      update: { activityPreferences: activityPreferencesIds },
      create: {
        planId,
        userId,
        activityPreferences: activityPreferencesIds,
        isPublished: false,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
