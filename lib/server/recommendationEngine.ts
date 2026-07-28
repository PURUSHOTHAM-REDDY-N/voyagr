/**
 * Deterministic context-aware recommendation engine.
 *
 * Implements the boolean filter formulation Rbase = { p in P | fdist(p) ^
 * fweather(p) ^ ftime(p) ^ fuser(p) } from the dissertation's section 3.4.1,
 * plus a ranking pass over the surviving candidates. It is pure, synchronous,
 * in-memory computation over an already-fetched candidate list (see
 * lib/ai/index.ts's generateCandidatePois) - no network/DB calls - so it is
 * fast enough to satisfy a sub-500ms latency target on its own, independent
 * of how long candidate generation itself took.
 *
 * Used two ways:
 *  - As a pre-filter inside the AI generation pipeline (generatePlanContent.ts),
 *    narrowing the candidates handed to the itinerary-writing prompt.
 *  - Standalone via POST /api/recommendations, for benchmarking and as the
 *    basis for the rule-based baseline engine used in the dissertation's
 *    RQ1 AI-vs-rule-based comparison.
 */

export type CandidatePoiInput = {
  name: string;
  category: string;
  weatherAlign: string; // "indoor" | "outdoor" | "all"
  openTime: string; // "HH:mm"
  closeTime: string; // "HH:mm"
  cost: number;
  coordinates: { lat: number; lng: number };
};

export type WeatherState = "Clear" | "Clouds" | "Rain" | "Drizzle" | "Thunderstorm" | "Snow" | "Mist" | string;

export type RecommendationContext = {
  /** Xst.Tcurr - defaults to the server's current time. */
  currentTime?: Date;
  /** Xenv.Wstate - live weather condition at the destination, if known. */
  weatherState?: WeatherState;
  /** Xuser.Catpref - the traveller's selected activity-preference tags. */
  activityPreferences?: string[];
  /** Xuser.Bmax - the traveller's maximum budget per activity, if set. */
  budget?: number;
  /** Minimum viable stay before closing time, in minutes (dissertation's Delta t_buffer, default 2h). */
  minStayMinutes?: number;
};

export type RankedPoi = CandidatePoiInput & { score: number };

const BAD_WEATHER_STATES = new Set(["Rain", "Drizzle", "Thunderstorm", "Snow"]);

function parseMinutesSinceMidnight(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

/**
 * Spatial proximity pass. The dissertation's formulation (Haversine(Lcurr, Lp)
 * <= 10km) assumes live device GPS, which Voyagr does not currently capture
 * (see the dissertation correction notes) - candidates are already scoped to
 * the destination by the generation prompt, so this degrades to a pass-through
 * until live location capture exists. Kept as its own function, rather than
 * inlined as `true`, so it stays a single, explicit place to wire in real
 * Haversine filtering against a live/destination coordinate later.
 */
export function fdist(_poi: CandidatePoiInput): boolean {
  return true;
}

/**
 * Core weather-compatibility check, shared by fweather() (candidate POI
 * filtering, this file) and the itinerary weather-forecast suitability
 * check (app/api/plans/[planId]/weather-forecast) - one place to reason
 * about what "compatible" means. Indoor/all venues are always viable;
 * outdoor venues require non-adverse weather. Missing weatherAlign (older
 * plans generated before this field existed, or malformed input) is
 * treated as unknown and does not penalise.
 */
export function isWeatherCompatible(
  weatherAlign: string | undefined | null,
  weatherState: WeatherState | undefined
): boolean {
  if (!weatherAlign) return true;
  const align = weatherAlign.toLowerCase();
  if (align === "indoor" || align === "all") return true;
  if (!weatherState) return true; // unknown weather - do not penalise
  return !BAD_WEATHER_STATES.has(weatherState);
}

/** Weather compatibility pass. Indoor/all venues are always viable; outdoor venues require non-adverse weather. */
export function fweather(poi: CandidatePoiInput, weatherState: WeatherState | undefined): boolean {
  return isWeatherCompatible(poi.weatherAlign, weatherState);
}

/** Temporal allocation pass: open now, with at least minStayMinutes before closing. */
export function ftime(poi: CandidatePoiInput, currentTime: Date, minStayMinutes: number): boolean {
  const openMin = parseMinutesSinceMidnight(poi.openTime);
  const closeMin = parseMinutesSinceMidnight(poi.closeTime);
  if (openMin === null || closeMin === null) return true; // malformed hours - do not penalise

  const nowMin = currentTime.getHours() * 60 + currentTime.getMinutes();
  return nowMin >= openMin && nowMin + minStayMinutes <= closeMin;
}

/** Profile constraint pass: category matches an explicit preference (if any), and cost is within budget (if set). */
export function fuser(poi: CandidatePoiInput, activityPreferences: string[] | undefined, budget: number | undefined): boolean {
  const preferenceOk =
    !activityPreferences || activityPreferences.length === 0 || activityPreferences.includes(poi.category);
  const budgetOk = budget === undefined || budget === null || poi.cost <= budget;
  return preferenceOk && budgetOk;
}

/**
 * Ranks a surviving POI by how well it fits the context, rewarding an
 * explicit preference match, weather-proof ("all") venues, and efficient use
 * of the remaining budget. Weights are deliberately simple/transparent
 * (rather than learned) so the ranking itself is auditable against the same
 * fdist/fweather/ftime/fuser inputs the filter pass already computed.
 */
function score(poi: CandidatePoiInput, context: RecommendationContext): number {
  let s = 0;
  if (context.activityPreferences?.includes(poi.category)) s += 2;
  if (poi.weatherAlign.toLowerCase() === "all") s += 1;
  if (context.budget && context.budget > 0) {
    s += Math.max(0, 1 - poi.cost / context.budget);
  }
  return s;
}

export function recommendPois(
  candidates: CandidatePoiInput[],
  context: RecommendationContext
): RankedPoi[] {
  const currentTime = context.currentTime ?? new Date();
  const minStayMinutes = context.minStayMinutes ?? 120;

  return candidates
    .filter(
      (poi) =>
        fdist(poi) &&
        fweather(poi, context.weatherState) &&
        ftime(poi, currentTime, minStayMinutes) &&
        fuser(poi, context.activityPreferences, context.budget)
    )
    .map((poi) => ({ ...poi, score: score(poi, context) }))
    .sort((a, b) => b.score - a.score);
}
