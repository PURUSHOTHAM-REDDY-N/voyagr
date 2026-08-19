"use server";
import { auth } from "@/auth";
import { formSchemaType } from "@/components/NewPlanForm";
import { db } from "@/lib/db";
import { kickOffPlanGeneration } from "@/lib/server/generatePlanContent";
import { redirect } from "next/navigation";
import { differenceInDays } from "date-fns";
import { waitUntil } from "@vercel/functions";

// Generation runs well past this server action's own return (it redirects
// almost immediately, then keeps going via waitUntil below) - on Vercel,
// without an explicit maxDuration, the platform is free to kill the
// invocation shortly after the response is sent, which silently drops the
// whole itinerary/image generation. A "use server" file may only export
// async functions, so that config has to live on the page(s) that render
// the form invoking this action instead - see their `maxDuration` exports.
export async function generatePlanAction(formData: formSchemaType) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const { placeName, activityPreferences, datesOfTravel, companion, travelPace, budget } = formData;
  const noOfDays = (differenceInDays(datesOfTravel.to, datesOfTravel.from) + 1).toString();
  const state = false; // isGeneratedUsingAI

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
      isGeneratedUsingAI: true,
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

  waitUntil(kickOffPlanGeneration(newPlan.id, placeName));

  redirect(`/plans/${newPlan.id}/plan?isNewPlan=true`);
}
