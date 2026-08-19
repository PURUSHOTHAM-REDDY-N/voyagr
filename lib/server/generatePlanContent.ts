import { createApi } from "unsplash-js";
import { differenceInCalendarDays } from "date-fns";
import { db } from "@/lib/db";
import { generatebatch1, generatebatch2, generateItineraryChunk, generateTopPlaces, generateCandidatePois } from "@/lib/ai";
import { uploadImageFromUrl } from "@/lib/s3";
import { withRetry } from "@/lib/server/retry";
import { recommendPois, CandidatePoiInput, RankedPoi, budgetTierToCap } from "@/lib/server/recommendationEngine";
import { getCurrentWeatherState } from "@/lib/server/weather";
import { fetchPlaceOpeningHours } from "@/lib/server/googlePlaces";
import { withTransitTimes } from "@/lib/server/geo";
import { geocodePlaceName, getDailyForecast } from "@/lib/server/openMeteo";

// Kept small: each chunk's response time needs to comfortably fit inside the
// Cloudflare Quick Tunnel's ~100s edge timeout in front of the self-hosted
// model - see generateItineraryDays.
const MAX_DAYS_PER_ITINERARY_CHUNK = 2;

const unsplashApi = createApi({
  accessKey: process.env.UNSPLASH_ACCESS_KEY!,
});

function parseFunctionCallArguments<T>(completion: any): T {
  const argumentsJson = completion?.choices[0]?.message?.function_call?.arguments as string;
  return JSON.parse(argumentsJson) as T;
}

export async function generateBatch1(planId: string) {
  await withRetry(async () => {
    const plan = await db.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error("Unable to find the empty plan while preparing a new one");

    const completion = await generatebatch1(plan.userPrompt);
    const result = parseFunctionCallArguments<{
      abouttheplace: string;
      besttimetovisit: string;
    }>(completion);

    await db.plan.update({
      where: { id: planId },
      data: {
        abouttheplace: result.abouttheplace,
        besttimetovisit: result.besttimetovisit,
        contentGenerationState: {
          update: {
            abouttheplace: true,
            besttimetovisit: true,
          },
        },
      },
    });
  });
}

export async function generateBatch2(planId: string, recommendedPois?: string[], weatherState?: string) {
  await withRetry(async () => {
    const plan = await db.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error("Unable to find the empty plan while preparing a new one");

    const planSettings = await db.planSettings.findUnique({ where: { planId } });
    if (!planSettings) throw new Error("Unable to find the plan metadata while preparing a new one");

    const completion = await generatebatch2({
      userPrompt: plan.userPrompt,
      activityPreferences: planSettings.activityPreferences,
      companion: planSettings.companion ?? undefined,
      fromDate: planSettings.fromDate?.getTime(),
      toDate: planSettings.toDate?.getTime(),
      travelPace: planSettings.travelPace ?? undefined,
      recommendedPois,
      weatherState,
    });

    const result = parseFunctionCallArguments<{
      adventuresactivitiestodo: string[];
      localcuisinerecommendations: string[];
      packingchecklist: string[];
    }>(completion);

    await db.plan.update({
      where: { id: planId },
      data: {
        adventuresactivitiestodo: result.adventuresactivitiestodo,
        localcuisinerecommendations: result.localcuisinerecommendations,
        packingchecklist: result.packingchecklist,
        contentGenerationState: {
          update: {
            adventuresactivitiestodo: true,
            localcuisinerecommendations: true,
            packingchecklist: true,
          },
        },
      },
    });
  });
}

/**
 * Builds the weatherState string for one chunk's specific day range, e.g.
 * "Day 3: Rain, Day 4: Clear" - falls back to the blanket "right now"
 * snapshot only when no per-day forecast is available at all for this range
 * (trip far enough out that Open-Meteo's ~16 day horizon doesn't cover it
 * yet), rather than silently reusing whatever the weather happened to be
 * when generation was kicked off.
 */
async function describeChunkWeather(
  coordinates: { lat: number; lng: number } | undefined,
  fromDate: Date | null | undefined,
  chunkStart: number,
  chunkEnd: number,
  fallbackWeatherState: string | undefined
): Promise<string | undefined> {
  if (!coordinates || !fromDate) return fallbackWeatherState;

  const chunkStartDate = new Date(fromDate);
  chunkStartDate.setDate(chunkStartDate.getDate() + (chunkStart - 1));
  const chunkEndDate = new Date(fromDate);
  chunkEndDate.setDate(chunkEndDate.getDate() + (chunkEnd - 1));

  const forecast = await getDailyForecast(coordinates.lat, coordinates.lng, chunkStartDate, chunkEndDate);
  if (forecast.length === 0) return fallbackWeatherState;

  if (forecast.length === 1) return forecast[0].weatherState;

  const forecastByDate = new Map(forecast.map((day) => [day.date, day.weatherState]));
  const parts: string[] = [];
  for (let dayNumber = chunkStart; dayNumber <= chunkEnd; dayNumber++) {
    const date = new Date(fromDate);
    date.setDate(date.getDate() + (dayNumber - 1));
    const state = forecastByDate.get(date.toISOString().split("T")[0]);
    if (state) parts.push(`Day ${dayNumber}: ${state}`);
  }
  return parts.length > 0 ? parts.join(", ") : fallbackWeatherState;
}

/**
 * Generates the itinerary in day-range chunks (2 days at a time) instead of
 * one call for the whole trip - a single call covering, say, 10 days of
 * activities-with-coordinates-and-reasoning was reliably exceeding the
 * Cloudflare Quick Tunnel's ~100s edge timeout (HTTP 524) and leaving the
 * plan permanently stuck with an empty itinerary. Chunks are generated
 * sequentially, not in parallel, since they all hit the same single
 * self-hosted model instance - running them concurrently would just queue
 * behind each other while additionally risking multiple simultaneous
 * timeouts instead of one clean retry at a time.
 */
export async function generateItineraryDays(
  planId: string,
  recommendedPois?: string[],
  weatherState?: string,
  rankedPois?: RankedPoi[]
) {
  const plan = await db.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Unable to find the empty plan while preparing a new one");

  const planSettings = await db.planSettings.findUnique({ where: { planId } });
  if (!planSettings) throw new Error("Unable to find the plan metadata while preparing a new one");

  const totalDays =
    planSettings.fromDate && planSettings.toDate
      ? Math.max(1, differenceInCalendarDays(planSettings.toDate, planSettings.fromDate) + 1)
      : 3;

  // weatherState (the caller's arg) is a single "right now" snapshot from
  // generateRecommendedPois - reusing it identically for every chunk of a
  // multi-day trip previously told the model it was raining on every single
  // day, regardless of that chunk's actual dates. Geocode once, then fetch
  // each chunk's own forecast so a rainy Day 3 doesn't get generated using
  // Day 1's (or "right now"'s) weather.
  const coordinates = planSettings.fromDate ? await geocodePlaceName(plan.nameoftheplace) : undefined;

  const allDays: { title: string; activities: { morning: any[]; afternoon: any[]; evening: any[] } }[] = [];

  for (let chunkStart = 1; chunkStart <= totalDays; chunkStart += MAX_DAYS_PER_ITINERARY_CHUNK) {
    const chunkEnd = Math.min(chunkStart + MAX_DAYS_PER_ITINERARY_CHUNK - 1, totalDays);
    const dayRangeLabel =
      chunkStart === chunkEnd
        ? `day ${chunkStart} (of ${totalDays} total days)`
        : `days ${chunkStart} to ${chunkEnd} (of ${totalDays} total days)`;

    const chunkWeatherState = await describeChunkWeather(
      coordinates,
      planSettings.fromDate,
      chunkStart,
      chunkEnd,
      weatherState
    );

    const chunkDays = await withRetry(
      async () => {
        const completion = await generateItineraryChunk({
          userPrompt: plan.userPrompt,
          activityPreferences: planSettings.activityPreferences,
          companion: planSettings.companion ?? undefined,
          fromDate: planSettings.fromDate?.getTime(),
          toDate: planSettings.toDate?.getTime(),
          travelPace: planSettings.travelPace ?? undefined,
          recommendedPois,
          weatherState: chunkWeatherState,
          dayRangeLabel,
        });
        const result = parseFunctionCallArguments<{ itinerary: typeof allDays }>(completion);
        return result.itinerary;
      },
      { maxAttempts: 2, baseDelayMs: 500 }
    );

    allDays.push(...chunkDays);
  }

  // "Dynamic Itinerary Generation ... with built-in travel time allocations":
  // computed deterministically from each activity's own coordinates rather
  // than trusting the LLM to invent a plausible-sounding transit time.
  const itineraryWithTransit = allDays.map((day) => ({
    title: day.title,
    activities: withTransitTimes(day.activities),
  }));

  // "Context-Aware Recommendations ... dropping incompatible options before
  // they reach the user": when the recommendation engine's filter/rank pass
  // succeeded, Top Places to Visit is taken directly from its survivors
  // (already excluded on weather/time/budget/preference) instead of asking
  // the LLM to separately invent an unfiltered list.
  const topplacestovisit =
    rankedPois && rankedPois.length > 0
      ? rankedPois.slice(0, 8).map((poi) => ({ name: poi.name, coordinates: poi.coordinates }))
      : await withRetry(async () => {
          const completion = await generateTopPlaces({
            userPrompt: plan.userPrompt,
            activityPreferences: planSettings.activityPreferences,
            companion: planSettings.companion ?? undefined,
            fromDate: planSettings.fromDate?.getTime(),
            toDate: planSettings.toDate?.getTime(),
            travelPace: planSettings.travelPace ?? undefined,
            recommendedPois,
            weatherState,
          });
          return parseFunctionCallArguments<{ topplacestovisit: typeof plan.topplacestovisit }>(completion)
            .topplacestovisit;
        });

  await db.plan.update({
    where: { id: planId },
    data: {
      itinerary: itineraryWithTransit,
      topplacestovisit,
      contentGenerationState: {
        update: {
          itinerary: true,
          topplacestovisit: true,
        },
      },
    },
  });
}

/**
 * Regenerates a single itinerary day in place, leaving every other day
 * untouched - the "plan was made before the forecast existed, now the
 * weather doesn't suit this day" fix. Looks up the live forecast for that
 * specific calendar date (if the trip is now within Open-Meteo's ~16 day
 * horizon) and steers generation away from whatever the forecast says,
 * the same way initial generation is steered by live weather.
 */
export async function regenerateItineraryDay(planId: string, dayTitle: string) {
  const plan = await db.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Unable to find the plan while regenerating a day");

  const dayIndex = plan.itinerary.findIndex((day) => day.title === dayTitle);
  if (dayIndex === -1) throw new Error(`No itinerary day titled "${dayTitle}" on plan ${planId}`);

  const planSettings = await db.planSettings.findUnique({ where: { planId } });
  if (!planSettings) throw new Error("Unable to find the plan metadata while regenerating a day");

  let weatherState: string | undefined;
  if (planSettings.fromDate) {
    const dayDate = new Date(planSettings.fromDate);
    dayDate.setDate(dayDate.getDate() + dayIndex);
    const coordinates = await geocodePlaceName(plan.nameoftheplace);
    if (coordinates) {
      const [forecastDay] = await getDailyForecast(coordinates.lat, coordinates.lng, dayDate, dayDate);
      weatherState = forecastDay?.weatherState;
    }
  }

  const totalDays = plan.itinerary.length;

  // The whole point of hitting "regenerate" is wanting something different -
  // tell the model exactly which places it already picked for this day so it
  // doesn't just reshuffle them into different time slots (which is what a
  // near-identical prompt at a low, deterministic-leaning temperature tends
  // to produce), and drop them from the steering list too so nothing is
  // pulling the model back toward the same picks.
  const existingPlaces = [
    ...plan.itinerary[dayIndex].activities.morning,
    ...plan.itinerary[dayIndex].activities.afternoon,
    ...plan.itinerary[dayIndex].activities.evening,
  ].map((activity) => activity.itineraryItem);

  const recommendedPois = plan.recommendedPois
    .map((poi) => poi.name)
    .filter((name) => !existingPlaces.some((existing) => existing.includes(name) || name.includes(existing)));

  const regeneratedDay = await withRetry(
    async () => {
      const completion = await generateItineraryChunk({
        userPrompt: plan.userPrompt,
        activityPreferences: planSettings.activityPreferences,
        companion: planSettings.companion ?? undefined,
        fromDate: planSettings.fromDate?.getTime(),
        toDate: planSettings.toDate?.getTime(),
        travelPace: planSettings.travelPace ?? undefined,
        recommendedPois,
        weatherState,
        excludePlaces: existingPlaces,
        temperature: 0.9,
        dayRangeLabel: `ONLY day ${dayIndex + 1} (of ${totalDays} total days) - this replaces a single existing day, do not generate any other day`,
      });
      const result = parseFunctionCallArguments<{ itinerary: (typeof plan.itinerary)[number][] }>(completion);
      if (!result.itinerary[0]) throw new Error("model returned no day for the regeneration request");
      return result.itinerary[0];
    },
    { maxAttempts: 2, baseDelayMs: 500 }
  );

  // Keep the original title (not whatever the model generated) so day
  // ordering/keying and the calendar-date mapping used by the
  // weather-forecast route stay stable across a regeneration.
  const newDay = {
    title: dayTitle,
    activities: withTransitTimes(regeneratedDay.activities),
  };

  const newItinerary = [...plan.itinerary];
  newItinerary[dayIndex] = newDay;

  await db.plan.update({
    where: { id: planId },
    data: { itinerary: newItinerary },
  });

  return newDay;
}

/**
 * Objective 1's "Context-Aware Recommendation System": the LLM proposes a
 * broad set of candidate POIs, then the deterministic recommendationEngine
 * filters/ranks them against the traveller's budget, activity preferences,
 * and the destination's live weather - before the narrative itinerary is
 * written. The filtered/ranked list is persisted on the plan (transparency,
 * and reusable as the rule-based baseline's input later) and returned as
 * plain names to steer generateBatch2/generateBatch3's prompts, and the
 * live weather condition observed along the way so the itinerary batch can
 * ground its contextualReasoning in the same data the filter used.
 */
type RecommendedPoisResult = { names: string[]; ranked: RankedPoi[]; weatherState?: string };

export async function generateRecommendedPois(planId: string): Promise<RecommendedPoisResult> {
  // Only 2 attempts, no exponential backoff: a failure here is almost always
  // the local model + Cloudflare Quick Tunnel's ~100s edge timeout (HTTP
  // 524), not a transient blip - retrying with the default 3 attempts and
  // growing delays just stacks multiple ~100s+ waits before batch2/batch3
  // (which are waiting on this) get to fall back and run without it.
  return withRetry(
    async () => {
      const plan = await db.plan.findUnique({ where: { id: planId } });
      if (!plan) throw new Error("Unable to find the plan while generating recommended POIs");

      const planSettings = await db.planSettings.findUnique({ where: { planId } });

      const [completion, weatherState] = await Promise.all([
        generateCandidatePois(plan.nameoftheplace),
        getCurrentWeatherState(plan.nameoftheplace),
      ]);

      const { candidates } = parseFunctionCallArguments<{ candidates: CandidatePoiInput[] }>(completion);

      // The LLM only guesses "typical" hours - overwrite with the real thing
      // where Places has it, so ftime()'s open-now filter isn't ranking
      // candidates against a hallucination. Every candidate is tagged with the
      // provenance of its hours (hoursVerified): a Places hit is VERIFIED and
      // eligible for the temporal filter; a miss keeps the LLM's guess as a
      // MODEL_ESTIMATE, which is surfaced but never used to hard-reject or
      // asserted as fact. This keeps the opening-hours guarantee true only
      // where the data is actually grounded, rather than silently trusting a
      // guess as if it were real.
      const candidatesWithRealHours = await Promise.all(
        candidates.map(async (candidate) => {
          const hours = await fetchPlaceOpeningHours(`${candidate.name}, ${plan.nameoftheplace}`);
          return hours
            ? { ...candidate, ...hours, hoursVerified: true }
            : { ...candidate, hoursVerified: false };
        })
      );

      const ranked = recommendPois(candidatesWithRealHours, {
        weatherState,
        activityPreferences: planSettings?.activityPreferences,
        budget: budgetTierToCap(planSettings?.budget),
      }).slice(0, 12);

      await db.plan.update({
        where: { id: planId },
        data: { recommendedPois: ranked },
      });

      return { names: ranked.map((poi) => poi.name), ranked, weatherState };
    },
    { maxAttempts: 2, baseDelayMs: 500 }
  );
}

export async function generatePlanImage(planId: string, prompt: string) {
  await withRetry(async () => {
    const name = prompt.split(",")[0] ?? prompt;

    const imageObject = await unsplashApi.search.getPhotos({
      query: name,
      orientation: "landscape",
      page: 1,
      perPage: 1,
    });
    const result = imageObject?.response?.results?.[0];
    if (!result) {
      console.log(`Error getting image from unsplash planId: ${planId}`);
      return;
    }

    const { key, url } = await uploadImageFromUrl(result.urls.regular, "plan-images");

    await db.plan.update({
      where: { id: planId },
      data: {
        imageKey: key,
        imageUrl: url,
        contentGenerationState: {
          update: {
            imagination: true,
          },
        },
      },
    });
  });
}

/**
 * batch2/the itinerary describe places (activities, day plan, top places to
 * visit), so they wait on the recommendation engine's filtered/ranked POI
 * list to steer them - everything else still fires independently. If
 * recommendation generation fails even after retries, they still run, just
 * without the steering hint, rather than losing that content.
 */
async function generateContextAwareBatches(planId: string) {
  let recommended: RecommendedPoisResult | undefined;
  try {
    recommended = await generateRecommendedPois(planId);
  } catch (e) {
    console.error(`generateRecommendedPois failed for ${planId}, continuing without it`, e);
  }

  await Promise.all([
    generateBatch2(planId, recommended?.names, recommended?.weatherState),
    generateItineraryDays(planId, recommended?.names, recommended?.weatherState, recommended?.ranked),
  ]);
}

/** Fire off all generation tasks for a newly created AI plan without blocking the caller. */
export function kickOffPlanGeneration(planId: string, prompt: string) {
  generatePlanImage(planId, prompt).catch((e) => console.error(`generatePlanImage failed for ${planId}`, e));
  generateBatch1(planId).catch((e) => console.error(`generateBatch1 failed for ${planId}`, e));
  generateContextAwareBatches(planId).catch((e) => console.error(`generateContextAwareBatches failed for ${planId}`, e));
}

/** Fire off only the image generation task, for empty (non-AI) plans. */
export function kickOffImageGeneration(planId: string, prompt: string) {
  generatePlanImage(planId, prompt).catch((e) => console.error(`generatePlanImage failed for ${planId}`, e));
}
