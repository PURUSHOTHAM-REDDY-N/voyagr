/**
 * Shared evaluation harness for the three research-question experiments
 * (rq1/rq2/rq3 *.test.ts in this directory).
 *
 * These are *controlled algorithmic experiments*, not live-model studies. The
 * language model's candidate-proposal step is represented by hand-authored
 * fixture pools with known ground truth, so each experiment isolates the
 * deterministic algorithmic property the corresponding research question
 * turns on:
 *   - RQ1: the effect of a broader, model-proposed candidate pool,
 *   - RQ2: the effect of grounding guessed opening hours in real ones,
 *   - RQ3: robustness under constraint conflict (the null-set collapse).
 *
 * End-to-end quality of the actual self-hosted model is a separate, live
 * benchmark; see the dissertation's evaluation chapter. Everything here is
 * pure and deterministic so it runs in CI with no network or model access.
 */

import {
  recommendPois,
  isWeatherCompatible,
  type CandidatePoiInput,
  type RecommendationContext,
  type WeatherState,
} from "../recommendationEngine";

/**
 * A point of interest with *ground-truth* attributes. `real*` fields are the
 * true opening hours (what Google Places grounding would return); `guessed*`
 * fields are what the model might invent before grounding. Metrics are always
 * scored against the real fields.
 */
export type PoiTruth = {
  name: string;
  category: string;
  weatherAlign: "indoor" | "outdoor" | "all";
  realOpen: string; // "HH:mm" - the true hours
  realClose: string;
  guessedOpen: string; // "HH:mm" - the model's pre-grounding guess
  guessedClose: string;
  cost: number;
};

/** Project a ground-truth POI into the engine's input shape, using either the real or guessed hours. */
export function project(t: PoiTruth, hours: "real" | "guessed"): CandidatePoiInput {
  return {
    name: t.name,
    category: t.category,
    weatherAlign: t.weatherAlign,
    openTime: hours === "real" ? t.realOpen : t.guessedOpen,
    closeTime: hours === "real" ? t.realClose : t.guessedClose,
    cost: t.cost,
    coordinates: { lat: 0, lng: 0 },
  };
}

function parseMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  return h * 60 + min;
}

/** True iff the POI is genuinely open at `time` with `bufferMin` to spare, per its REAL hours. */
export function isActuallyOpen(t: PoiTruth, time: Date, bufferMin: number): boolean {
  const open = parseMinutes(t.realOpen);
  const close = parseMinutes(t.realClose);
  if (open === null || close === null) return true; // malformed truth is not counted as an error
  const now = time.getHours() * 60 + time.getMinutes();
  return now >= open && now + bufferMin <= close;
}

/** True iff the POI is genuinely weather-appropriate, per its real weather alignment. */
export function isActuallyWeatherOk(t: PoiTruth, weather: WeatherState | undefined): boolean {
  return isWeatherCompatible(t.weatherAlign, weather);
}

export type PrecisionResult = {
  returned: number;
  correct: number;
  /** Fraction of returned items that are genuinely open AND weather-appropriate. 1 when nothing is returned (vacuously precise). */
  precision: number;
};

/**
 * Contextual precision: of the items the engine actually recommended, how many
 * are correct against ground truth (really open at the query time and really
 * weather-appropriate).
 */
export function contextualPrecision(
  resultNames: string[],
  truthByName: Map<string, PoiTruth>,
  time: Date,
  weather: WeatherState | undefined,
  bufferMin: number
): PrecisionResult {
  const returned = resultNames.length;
  if (returned === 0) return { returned: 0, correct: 0, precision: 1 };
  let correct = 0;
  for (const name of resultNames) {
    const t = truthByName.get(name);
    if (!t) continue;
    if (isActuallyOpen(t, time, bufferMin) && isActuallyWeatherOk(t, weather)) correct += 1;
  }
  return { returned, correct, precision: correct / returned };
}

/** Factual-error rate: fraction of returned items that are, in reality, CLOSED at the query time. */
export function factualErrorRate(
  resultNames: string[],
  truthByName: Map<string, PoiTruth>,
  time: Date,
  bufferMin: number
): number {
  if (resultNames.length === 0) return 0;
  let closed = 0;
  for (const name of resultNames) {
    const t = truthByName.get(name);
    if (t && !isActuallyOpen(t, time, bufferMin)) closed += 1;
  }
  return closed / resultNames.length;
}

/** Preference coverage: how many of the requested preference categories appear in the result set. */
export function preferenceCoverage(resultNames: string[], truthByName: Map<string, PoiTruth>, prefs: string[]): number {
  const present = new Set<string>();
  for (const name of resultNames) {
    const t = truthByName.get(name);
    if (t && prefs.includes(t.category)) present.add(t.category);
  }
  return present.size;
}

export function truthMap(pool: PoiTruth[]): Map<string, PoiTruth> {
  return new Map(pool.map((t) => [t.name, t]));
}

/**
 * Models the generative pipeline's *weather steering + open-ended substitution*
 * behaviour deterministically. Where the boolean baseline hard-eliminates any
 * item failing a single predicate, the generative layer (per the enforced
 * weather rule in the itinerary prompt, and its freedom to propose a different
 * item) relaxes the rigid category gate to substitute a weather-appropriate
 * alternative rather than returning nothing.
 *
 * Concretely: keep items that are open and within budget, then keep only those
 * that are weather-appropriate. Preferred-category items are still ranked
 * highest, but a compatible non-preferred item is admitted as a substitute
 * instead of collapsing the set to empty.
 */
export function generativeRecommend(pool: CandidatePoiInput[], context: RecommendationContext): CandidatePoiInput[] {
  const now = context.currentTime ?? new Date();
  const buffer = context.minStayMinutes ?? 120;

  const openAndAffordable = pool.filter((p) => {
    const open = parseMinutes(p.openTime);
    const close = parseMinutes(p.closeTime);
    const timeOk = open === null || close === null || (now.getHours() * 60 + now.getMinutes() >= open && now.getHours() * 60 + now.getMinutes() + buffer <= close);
    const budgetOk = context.budget === undefined || context.budget === null || p.cost <= context.budget;
    return timeOk && budgetOk;
  });

  const weatherOk = openAndAffordable.filter((p) => isWeatherCompatible(p.weatherAlign, context.weatherState));

  return weatherOk
    .map((p) => {
      let s = 0;
      if (context.activityPreferences?.includes(p.category)) s += 2; // preferred category still wins
      if (p.weatherAlign.toLowerCase() === "all") s += 1;
      if (context.budget && context.budget > 0) s += Math.max(0, 1 - p.cost / context.budget);
      return { p, s };
    })
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p);
}

// Re-export so the individual experiments can import everything from one place.
export { recommendPois, isWeatherCompatible };
export type { CandidatePoiInput, RecommendationContext, WeatherState };
