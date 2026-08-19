/**
 * RQ3 - Does the generative layer remain robust under constraint conflict where
 * the rule-based baseline collapses?
 *
 * This targets the "Null-Set Collapse" limitation (dissertation section 3.4.1 B):
 * when a traveller's outdoor preference conflicts with adverse weather, the
 * boolean baseline hard-eliminates the outdoor items (fweather) AND the indoor
 * alternatives (fuser category gate), returning an empty set. The generative
 * layer, modelled by generativeRecommend, relaxes the rigid category gate to
 * substitute weather-appropriate alternatives instead of returning nothing.
 *
 * Hypothesis: on conflict scenarios the baseline returns an empty (or near-empty)
 * set, while the generative layer returns a populated, wholly weather-appropriate
 * set.
 */

import { recommendPois, generativeRecommend, project, isWeatherCompatible, type PoiTruth } from "./harness";

// The traveller wants outdoor activities, but it is raining.
const TIME = new Date(2026, 5, 1, 12, 0);
const WEATHER = "Rain" as const;
const PREFS = ["park", "garden"]; // both outdoor categories
const BUDGET = 40;
const BUFFER = 120;

const POOL: PoiTruth[] = [
  // Preferred but outdoor - incompatible with rain.
  { name: "Botanic Garden", category: "garden", weatherAlign: "outdoor", realOpen: "08:00", realClose: "18:00", guessedOpen: "08:00", guessedClose: "18:00", cost: 5 },
  { name: "Central Park", category: "park", weatherAlign: "outdoor", realOpen: "06:00", realClose: "22:00", guessedOpen: "06:00", guessedClose: "22:00", cost: 0 },
  // Weather-appropriate alternatives, but NOT in the traveller's stated categories.
  { name: "Natural History Museum", category: "museum", weatherAlign: "indoor", realOpen: "09:00", realClose: "18:00", guessedOpen: "09:00", guessedClose: "18:00", cost: 14 },
  { name: "Glasshouse Conservatory", category: "attraction", weatherAlign: "all", realOpen: "09:00", realClose: "17:00", guessedOpen: "09:00", guessedClose: "17:00", cost: 9 },
  { name: "Aquarium", category: "attraction", weatherAlign: "indoor", realOpen: "10:00", realClose: "19:00", guessedOpen: "10:00", guessedClose: "19:00", cost: 22 },
];

describe("RQ3: robustness under constraint conflict (null-set collapse)", () => {
  const input = POOL.map((t) => project(t, "real"));
  const ctx = { currentTime: TIME, weatherState: WEATHER, activityPreferences: PREFS, budget: BUDGET, minStayMinutes: BUFFER };

  const baseline = recommendPois(input, ctx).map((r) => r.name);
  const generative = generativeRecommend(input, ctx).map((r) => r.name);

  it("reports the RQ3 metrics", () => {
    // eslint-disable-next-line no-console
    console.log("[RQ3]", {
      scenario: "outdoor preference + Rain",
      baseline: { results: baseline, count: baseline.length },
      generative: { results: generative, count: generative.length },
    });
  });

  it("the baseline collapses to an empty set under conflict", () => {
    expect(baseline).toEqual([]);
  });

  it("the generative layer still returns usable recommendations", () => {
    expect(generative.length).toBeGreaterThan(0);
  });

  it("every generative substitute is weather-appropriate", () => {
    const align = new Map(POOL.map((t) => [t.name, t.weatherAlign]));
    for (const name of generative) {
      expect(isWeatherCompatible(align.get(name), WEATHER)).toBe(true);
    }
    // The rained-out outdoor favourites are correctly excluded.
    expect(generative).not.toEqual(expect.arrayContaining(["Botanic Garden", "Central Park"]));
  });
});
