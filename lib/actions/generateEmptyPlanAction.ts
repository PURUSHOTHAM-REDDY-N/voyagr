"use server";
import { auth } from "@/auth";
import { formSchemaType } from "@/components/NewPlanForm";
import { db } from "@/lib/db";
import { kickOffImageGeneration } from "@/lib/server/generatePlanContent";
import { redirect } from "next/navigation";
import { differenceInDays } from "date-fns";

export async function generateEmptyPlanAction(formData: formSchemaType) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const { placeName, activityPreferences, datesOfTravel, companion, travelPace, budget } = formData;
  const noOfDays = differenceInDays(datesOfTravel.from, datesOfTravel.to).toString();
  const state = true; // isGeneratedUsingAI: false

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
      isGeneratedUsingAI: false,
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
      activityPreferences,
      fromDate: datesOfTravel.from,
      toDate: datesOfTravel.to,
      companion,
      travelPace,
      budget,
      isPublished: false,
    },
  });

  console.log(`createEmptyPlan called by ${userId} on planId : ${newPlan.id}`);

  kickOffImageGeneration(newPlan.id, placeName);

  redirect(`/plans/${newPlan.id}/plan?isNewPlan=true`);
}
