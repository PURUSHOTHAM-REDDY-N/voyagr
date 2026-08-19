/**
 * RQ2 - Does deterministic grounding reduce factual errors (recommending
 * places that are actually closed) in the itinerary pipeline?
 *
 * Isolated variable: grounding. With grounding OFF, the engine filters on the
 * model's *guessed* opening hours; with grounding ON, real opening hours (as
 * fetchPlaceOpeningHours would return from Google Places) overwrite the guesses
 * before filtering. Correctness is always scored against the real hours.
 *
 * Hypothesis: grounding strictly reduces the factual-error rate - the fraction
 * of recommended venues that are, in reality, closed at the query time.
 */

import { recommendPois, project, truthMap, factualErrorRate, type PoiTruth } from "./harness";

// Early-evening query. Several venues are optimistically over-reported by the model
// (guessed to stay open late) but actually close earlier.
const TIME = new Date(2026, 5, 1, 18, 30);
const WEATHER = "Clear" as const;
const BUFFER = 60;

const POOL: PoiTruth[] = [
  // Model guesses these stay open until 21:00-22:00; in reality they close at 17:00-18:00.
  { name: "Old Town Museum", category: "museum", weatherAlign: "indoor", realOpen: "09:00", realClose: "17:00", guessedOpen: "09:00", guessedClose: "21:00", cost: 12 },
  { name: "Heritage Gallery", category: "gallery", weatherAlign: "indoor", realOpen: "10:00", realClose: "18:00", guessedOpen: "10:00", guessedClose: "22:00", cost: 10 },
  { name: "Cathedral Tower", category: "landmark", weatherAlign: "outdoor", realOpen: "09:00", realClose: "17:30", guessedOpen: "09:00", guessedClose: "20:00", cost: 8 },
  // These are genuinely open in the evening; the guess happens to be right.
  { name: "Night Market", category: "market", weatherAlign: "all", realOpen: "17:00", realClose: "23:00", guessedOpen: "17:00", guessedClose: "23:00", cost: 0 },
  { name: "Late Bistro", category: "food", weatherAlign: "indoor", realOpen: "12:00", realClose: "23:30", guessedOpen: "12:00", guessedClose: "23:30", cost: 25 },
];

describe("RQ2: grounding reduces factual errors", () => {
  const truth = truthMap(POOL);
  const ctx = { currentTime: TIME, weatherState: WEATHER, minStayMinutes: BUFFER };

  // Grounding OFF: filter on the model's guessed hours.
  const ungrounded = recommendPois(POOL.map((t) => project(t, "guessed")), ctx).map((r) => r.name);
  // Grounding ON: real hours overwrite the guesses before filtering.
  const grounded = recommendPois(POOL.map((t) => project(t, "real")), ctx).map((r) => r.name);

  const errOff = factualErrorRate(ungrounded, truth, TIME, BUFFER);
  const errOn = factualErrorRate(grounded, truth, TIME, BUFFER);

  it("reports the RQ2 metrics", () => {
    // eslint-disable-next-line no-console
    console.log("[RQ2]", {
      groundingOff: { results: ungrounded.map(String), factualErrorRate: errOff },
      groundingOn: { results: grounded.map(String), factualErrorRate: errOn },
    });
    expect(ungrounded.length).toBeGreaterThan(0);
    expect(grounded.length).toBeGreaterThan(0);
  });

  it("without grounding, the engine recommends venues that are actually closed", () => {
    expect(errOff).toBeGreaterThan(0);
    // Specifically, the three over-reported venues leak through on guessed hours.
    expect(ungrounded).toEqual(expect.arrayContaining(["Old Town Museum", "Heritage Gallery", "Cathedral Tower"]));
  });

  it("grounding eliminates the closed-venue recommendations", () => {
    expect(errOn).toBe(0);
    expect(grounded).not.toEqual(expect.arrayContaining(["Old Town Museum", "Heritage Gallery", "Cathedral Tower"]));
  });

  it("grounding strictly lowers the factual-error rate", () => {
    expect(errOn).toBeLessThan(errOff);
  });

  it("genuinely-open venues survive grounding", () => {
    expect(grounded).toEqual(expect.arrayContaining(["Night Market", "Late Bistro"]));
  });
});
