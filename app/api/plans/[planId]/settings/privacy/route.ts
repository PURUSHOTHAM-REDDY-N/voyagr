import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId, handleApiError, ApiError } from "@/lib/api-utils";
import type { Plan } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const userId = await requireUserId();
    const { planId } = params;
    const { isPublished } = await req.json();

    const plan = await db.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new ApiError("Unable to published the Plan as we could not find it.");
    }

    if (isPublished) {
      const requiredFields: {
        name: keyof Plan;
        displayName: string;
        isValid: (val: any) => boolean;
      }[] = [
        {
          name: "abouttheplace",
          displayName: "About the Place",
          isValid: (val: typeof plan.abouttheplace) =>
            typeof val === "string" && val.trim().length > 0,
        },
        {
          name: "adventuresactivitiestodo",
          displayName: "Top activities to look for",
          isValid: (val: typeof plan.adventuresactivitiestodo) =>
            Array.isArray(val) && val.length > 0,
        },
        {
          name: "topplacestovisit",
          displayName: "Top places to visit",
          isValid: (val: typeof plan.topplacestovisit) =>
            Array.isArray(val) && val.length > 0,
        },
        {
          name: "packingchecklist",
          displayName: "Packing Checklist",
          isValid: (val: typeof plan.packingchecklist) =>
            Array.isArray(val) && val.length > 0,
        },
        {
          name: "localcuisinerecommendations",
          displayName: "Local Cuisine Recommendations",
          isValid: (val: typeof plan.localcuisinerecommendations) =>
            Array.isArray(val) && val.length > 0,
        },
        {
          name: "besttimetovisit",
          displayName: "Best Time To Visit",
          isValid: (val: typeof plan.besttimetovisit) =>
            typeof val === "string" && val.trim().length > 0,
        },
        {
          name: "itinerary",
          displayName: "Itinerary",
          isValid: (val: typeof plan.itinerary) =>
            Array.isArray(val) &&
            val.length > 0 &&
            val.every(
              (day) =>
                typeof day.title === "string" &&
                day.title.trim().length > 0 &&
                Array.isArray(day.activities.morning) &&
                day.activities.morning.length > 0 &&
                Array.isArray(day.activities.afternoon) &&
                day.activities.afternoon.length > 0 &&
                Array.isArray(day.activities.evening) &&
                day.activities.evening.length > 0
            ),
        },
      ];

      const missingFields = requiredFields
        .filter(({ name, isValid }) => !isValid(plan[name]))
        .map((f) => f.displayName);

      if (missingFields.length > 0) {
        throw new ApiError(
          `Missing required fields: ${missingFields.join(", ")}.\n` +
            `Please complete all sections before publishing.`
        );
      }
    }

    await db.planSettings.upsert({
      where: { planId },
      update: { isPublished },
      create: { planId, userId, isPublished },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
