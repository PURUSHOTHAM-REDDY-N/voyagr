/**
 * Server-side lookup of a place's real opening/closing hours via the Places
 * API (New) Text Search endpoint. Used to replace generateCandidatePois's
 * LLM-guessed openTime/closeTime (lib/ai/index.ts, which only produces a
 * "typical" hour since the model has no ground truth) with real hours before
 * recommendationEngine.ts's ftime() filter runs against them.
 *
 * This resolves the two grounded states of a candidate's hours; the caller
 * (generateRecommendedPois) maps them onto CandidatePoiInput.hoursVerified:
 *   - a PlaceOpeningHours result => VERIFIED (real, eligible for the ftime gate)
 *   - undefined (no API key, network/HTTP failure, or no record for the place)
 *     => UNAVAILABLE, and the LLM's guess is retained as a MODEL_ESTIMATE that
 *     is displayed but never enforced or asserted as fact.
 */

export type PlaceOpeningHours = {
  openTime: string; // "HH:mm"
  closeTime: string; // "HH:mm"
};

type GooglePeriod = {
  open?: { day: number; hour: number; minute: number };
  close?: { day: number; hour: number; minute: number };
};

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * `query` should include enough context to disambiguate the place (e.g.
 * "Eiffel Tower, Paris, France") - a bare candidate name alone can match the
 * wrong place in another city entirely.
 */
export async function fetchPlaceOpeningHours(query: string): Promise<PlaceOpeningHours | undefined> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return undefined;

  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.regularOpeningHours",
      },
      body: JSON.stringify({ textQuery: query, pageSize: 1 }),
      cache: "no-cache",
    });
    if (!response.ok) return undefined;

    const data = await response.json();
    const periods = data?.places?.[0]?.regularOpeningHours?.periods as GooglePeriod[] | undefined;
    if (!periods || periods.length === 0) return undefined;

    // Prefer today's period so a single "typical hours" window (all
    // recommendationEngine.ts's ftime() understands) is at least accurate for
    // "right now" rather than an arbitrary weekday.
    const today = new Date().getDay(); // 0 = Sunday, matches Google's `day`
    const period = periods.find((p) => p.open?.day === today) ?? periods[0];
    if (!period.open) return undefined;

    const openTime = `${pad(period.open.hour)}:${pad(period.open.minute)}`;
    // A period with no `close` is Google's representation of "open 24 hours"
    // that day, not missing data.
    const closeTime = period.close ? `${pad(period.close.hour)}:${pad(period.close.minute)}` : "23:59";

    return { openTime, closeTime };
  } catch (error) {
    console.error(`failed to fetch opening hours for "${query}"`, error);
    return undefined;
  }
}
