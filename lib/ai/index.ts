import {
  batch1Schema,
  batch2Schema,
  itineraryChunkSchema,
  topPlacesSchema,
  candidatePoiSchema
} from "./schemas";



const OLLAMA_URL = process.env.OLLAMA_URL;

const MODEL = process.env.OLLAMA_MODEL;

const promptSuffix = `generate travel data according to the schema and in json format,
                     do not return anything in your response outside of curly braces, 
                     generate response as per the functin schema provided. Dates given,
                     activity preference and travelling with may influence likw 50% while generating plan.`;

const callLocalAI = async (
  prompt: string,
  schema: any,
  description: string,
  temperature: number = 0.4
) => {


  console.log({
    prompt,
    schema,
  });



  const finalPrompt = `

You are a helpful travel assistant.

${description}


JSON Schema:

${JSON.stringify(schema, null, 2)}


User Request:

${prompt}


${promptSuffix}

Return only JSON.
`;



  const response = await fetch(
    `${OLLAMA_URL}/api/generate`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },


      body: JSON.stringify({

        model: MODEL,

        prompt: finalPrompt,

        stream: false,

        format: "json",

        options: {

          temperature,

        }

      }),

    }
  );



  if (!response.ok) {

    throw new Error(
      `Ollama error ${response.status}`
    );

  }



  const data = await response.json();



  const json = JSON.parse(
    data.response
  );



  /*
    Wrapping the Ollama response in the same
    shape convex/plan.ts expects to parse
  */

  return {

    choices: [

      {

        message: {

          function_call: {

            name:
              "set_travel_details",

            arguments:
              JSON.stringify(json),

          },

        },

      },

    ],

  };

};

export const generateCandidatePois = (placeName: string) => {
  const prompt = `${placeName}, ${promptSuffix}`;
  // Kept deliberately small (12, not 20-30): this runs over a Cloudflare Quick
  // Tunnel in front of a self-hosted model, which has a hard ~100s edge
  // timeout (HTTP 524) - a larger candidate list risks the model not
  // finishing generation before the tunnel kills the connection.
  const description = `Generate a broad candidate list of points of interest for the destination according to the following schema, so a downstream recommendation engine can filter and rank it by budget, weather, opening hours and activity preference:

  - Candidates:
    - An array of exactly 12 points of interest, spanning a mix of the categories sightseeing, adventure, culturalexperiences, historical, relaxationwellness, shopping and nightlife.
    - Each candidate includes its name, category, weather alignment (indoor/outdoor/all), typical opening and closing time, approximate cost, and coordinates.
    - Keep every field terse - short names, no descriptions - this list is only consumed by code, not shown to the user.

  Ensure that the function response adheres to the schema provided and is in JSON format. The response should not contain anything outside of the defined schema.`;
  return callLocalAI(prompt, candidatePoiSchema, description);
}

export const generatebatch1 = (promptText: string) => {
  const prompt = `${promptText}, ${promptSuffix}`;
  const description = `Generate a description of information about a place or location according to the following schema:

  - About the Place:
    - A string containing information about the place, comprising at least 50 words.
  
  - Best Time to Visit:
    - A string specifying the best time to visit the place.
  
  Ensure that the function response adheres to the schema provided and is in JSON format. The response should not contain anything outside of the defined schema.
  `;
  return callLocalAI(prompt, batch1Schema, description);
}

type GeneratePlanInputType = {
  userPrompt: string;
  activityPreferences?: string[] | undefined;
  fromDate?: number | undefined;
  toDate?: number | undefined;
  companion?: string | undefined;
  travelPace?: string | undefined;
  recommendedPois?: string[] | undefined;
  weatherState?: string | undefined;
};

export const generatebatch2 = (inputParams: GeneratePlanInputType) => {
  const description = `Generate a description of recommendations for an adventurous trip according to the following schema:
  - Top Adventures Activities:
    - An array listing top adventure activities to do, including at least 5 activities.
    - Each activity should be specified along with its location.
  
  - Local Cuisine Recommendations:
    - An array providing recommendations for local cuisine to try during the trip.
  
  - Packing Checklist:
    - An array containing items that should be included in the packing checklist for the trip.
  
  Ensure that the function response adheres to the schema provided and is in JSON format. The response should not contain anything outside of the defined schema.`;
  return callLocalAI(getPropmpt(inputParams), batch2Schema, description);
}

/**
 * Generates the itinerary for one small range of days at a time (see
 * lib/server/generatePlanContent.ts's generateItineraryDays), rather than
 * the whole trip in one call - keeps the response small enough to reliably
 * finish within the local model's response window regardless of trip length.
 */
export const generateItineraryChunk = (
  inputParams: GeneratePlanInputType & {
    dayRangeLabel: string;
    /** Places to explicitly avoid reusing - see regenerateItineraryDay, which passes the day's own current places so a regenerate isn't just a reshuffle of the same picks. */
    excludePlaces?: string[];
    /** Ollama sampling temperature. Regeneration passes a higher value than the 0.4 default used for initial generation, since a near-identical prompt at low temperature tends to converge back on the same answer. */
    temperature?: number;
  }
) => {
  const excludeClause =
    inputParams.excludePlaces && inputParams.excludePlaces.length > 0
      ? `\n\n  Do not reuse any of these places, they have already been used for this day and the traveller wants a change: ${inputParams.excludePlaces.join(", ")}. Choose different places/activities entirely, not just a different time slot for the same ones.`
      : "";

  const description = `Generate a description of a travel itinerary according to the following schema:
  - Itinerary:
    - An array containing details of the itinerary for ONLY ${inputParams.dayRangeLabel} - do not generate any other days.
    - Each day's itinerary includes a title (state which day number it is) and activities for morning, afternoon, and evening.
    - Activities are described as follows:
      - Morning, Afternoon, Evening:
        - Each includes an array of itinerary items. Every item needs an itineraryItem, a briefDescription,
          coordinates (latitude and longitude of that specific activity/place - required, not the destination's
          coordinates), a weatherAlign (indoor, outdoor, or all - whether this specific activity is still viable
          in rain/snow), and a contextualReasoning sentence. contextualReasoning must explicitly reference which
          part of the traveller's stated profile (activity preferences, companion, travel pace, budget) this
          activity satisfies, and why it is a good fit given the current weather stated in the prompt - do not
          write a generic sentence, tie it to the specific inputs given.

  Weather rules - follow these strictly, they are more important than the traveller's stated preferences:
    - weatherAlign must be an honest classification of the PLACE itself, not adjusted to justify a choice: a
      market stall, beach, hike, or garden is "outdoor" even if parts of it are covered - being "mostly outdoor
      with some covered areas" is still "outdoor", not "indoor" or "all".
    - If the weather given in the prompt for a specific day is Rain, Drizzle, Thunderstorm, or Snow, do not put an
      "outdoor" activity as the primary choice for that day's morning/afternoon/evening slot - replace it with an
      "indoor" or "all" alternative instead. Only use an "outdoor" activity on a day marked with adverse weather if
      you explicitly say so in contextualReasoning and there is truly no reasonable indoor alternative.${excludeClause}

  Ensure that the function response adheres to the schema provided and is in JSON format. The response should not contain anything outside of the defined schema.`;
  return callLocalAI(getPropmpt(inputParams), itineraryChunkSchema, description, inputParams.temperature ?? 0.4);
}

/** Fallback only - used when the recommendation engine's output isn't available to derive Top Places to Visit from directly. */
export const generateTopPlaces = (inputParams: GeneratePlanInputType) => {
  const description = `Generate a description of the top places to visit according to the following schema:
  - Top Places to Visit:
    - An array listing the top places to visit along with their coordinates.
    - Each place includes a name and coordinates (latitude and longitude).

  Ensure that the function response adheres to the schema provided and is in JSON format. The response should not contain anything outside of the defined schema.`;
  return callLocalAI(getPropmpt(inputParams), topPlacesSchema, description);
}

const getPropmpt = ({ userPrompt, activityPreferences, companion, fromDate, toDate, travelPace, recommendedPois, weatherState }: GeneratePlanInputType) => {
  let prompt = `${userPrompt}, from date-${fromDate} to date-${toDate}`;

  if (companion && companion.length > 0) prompt += `, travelling with-${companion}`;

  if (activityPreferences && activityPreferences.length > 0) prompt += `, activity preferences-${activityPreferences.join(",")}`;

  if (weatherState) prompt += `, current weather at the destination-${weatherState}`;

  if (travelPace) prompt += `, preferred travel pace-${travelPace}`;

  if (recommendedPois && recommendedPois.length > 0) {
    prompt += `. Prioritise recommendations around these places, which have already been filtered and ranked for this traveller's budget, the current weather and their pace: ${recommendedPois.join(", ")}. You may include other well-known places too, but favour this list`;
  }

  prompt = `${prompt}, ${promptSuffix}`;
  return prompt;
}