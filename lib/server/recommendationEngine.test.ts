import {
  fdist,
  fweather,
  ftime,
  fuser,
  isWeatherCompatible,
  recommendPois,
  type CandidatePoiInput,
} from "./recommendationEngine";

const poi = (overrides: Partial<CandidatePoiInput> = {}): CandidatePoiInput => ({
  name: "Test POI",
  category: "museum",
  weatherAlign: "indoor",
  openTime: "09:00",
  closeTime: "17:00",
  cost: 20,
  coordinates: { lat: 0, lng: 0 },
  ...overrides,
});

describe("fdist", () => {
  it("always passes (no live GPS capture yet, see the doc comment)", () => {
    expect(fdist(poi())).toBe(true);
  });
});

describe("isWeatherCompatible / fweather", () => {
  it("indoor venues are always compatible, even in a thunderstorm", () => {
    expect(isWeatherCompatible("indoor", "Thunderstorm")).toBe(true);
  });

  it("'all' venues are always compatible", () => {
    expect(isWeatherCompatible("all", "Rain")).toBe(true);
  });

  it("outdoor venues are incompatible with rain/drizzle/thunderstorm/snow", () => {
    for (const bad of ["Rain", "Drizzle", "Thunderstorm", "Snow"]) {
      expect(isWeatherCompatible("outdoor", bad)).toBe(false);
    }
  });

  it("outdoor venues are compatible with clear or cloudy weather", () => {
    expect(isWeatherCompatible("outdoor", "Clear")).toBe(true);
    expect(isWeatherCompatible("outdoor", "Clouds")).toBe(true);
  });

  it("does not penalize when weather is unknown", () => {
    expect(isWeatherCompatible("outdoor", undefined)).toBe(true);
  });

  it("does not penalize when weatherAlign is missing (older plans)", () => {
    expect(isWeatherCompatible(undefined, "Rain")).toBe(true);
    expect(isWeatherCompatible(null, "Rain")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isWeatherCompatible("Outdoor", "Rain")).toBe(false);
    expect(isWeatherCompatible("INDOOR", "Rain")).toBe(true);
  });

  it("fweather delegates to isWeatherCompatible using the poi's weatherAlign", () => {
    expect(fweather(poi({ weatherAlign: "outdoor" }), "Rain")).toBe(false);
    expect(fweather(poi({ weatherAlign: "outdoor" }), "Clear")).toBe(true);
  });
});

describe("ftime", () => {
  const at = (hh: number, mm: number) => new Date(2026, 0, 1, hh, mm);

  it("passes when open with enough buffer before closing", () => {
    expect(ftime(poi({ openTime: "09:00", closeTime: "17:00" }), at(10, 0), 120)).toBe(true);
  });

  it("fails before opening time", () => {
    expect(ftime(poi({ openTime: "09:00", closeTime: "17:00" }), at(8, 0), 120)).toBe(false);
  });

  it("fails when there isn't enough time left before closing", () => {
    // closes 17:00, only 15 min of buffer requested but we're 5 min short
    expect(ftime(poi({ openTime: "09:00", closeTime: "17:00" }), at(16, 50), 15)).toBe(false);
  });

  it("passes exactly at the buffer boundary", () => {
    expect(ftime(poi({ openTime: "09:00", closeTime: "17:00" }), at(16, 45), 15)).toBe(true);
  });

  it("does not penalize malformed operating hours", () => {
    expect(ftime(poi({ openTime: "not-a-time", closeTime: "17:00" }), at(10, 0), 120)).toBe(true);
  });
});

describe("fuser", () => {
  it("passes anything when no preferences are set", () => {
    expect(fuser(poi({ category: "museum" }), undefined, undefined)).toBe(true);
    expect(fuser(poi({ category: "museum" }), [], undefined)).toBe(true);
  });

  it("requires the category to match an explicit preference", () => {
    expect(fuser(poi({ category: "museum" }), ["park"], undefined)).toBe(false);
    expect(fuser(poi({ category: "museum" }), ["museum", "park"], undefined)).toBe(true);
  });

  it("enforces the budget cap when set", () => {
    expect(fuser(poi({ cost: 50 }), undefined, 20)).toBe(false);
    expect(fuser(poi({ cost: 20 }), undefined, 20)).toBe(true);
    expect(fuser(poi({ cost: 5 }), undefined, 20)).toBe(true);
  });

  it("ignores budget when unset", () => {
    expect(fuser(poi({ cost: 100000 }), undefined, undefined)).toBe(true);
  });
});

describe("recommendPois", () => {
  const currentTime = new Date(2026, 0, 1, 10, 0);

  it("drops candidates that fail any filter and keeps the rest", () => {
    const candidates = [
      poi({ name: "Rainy Park", weatherAlign: "outdoor" }),
      poi({ name: "Closed Museum", openTime: "18:00", closeTime: "20:00" }),
      poi({ name: "Good Museum" }),
    ];
    const result = recommendPois(candidates, { currentTime, weatherState: "Rain" });
    expect(result.map((r) => r.name)).toEqual(["Good Museum"]);
  });

  it("ranks an explicit-preference match above a non-match", () => {
    const candidates = [poi({ name: "Park", category: "park" }), poi({ name: "Museum", category: "museum" })];
    const result = recommendPois(candidates, { currentTime, activityPreferences: ["museum"] });
    // "Park" fails fuser (doesn't match the only preference) and is dropped entirely
    expect(result.map((r) => r.name)).toEqual(["Museum"]);
  });

  it("ranks weather-proof ('all') venues above single-mode venues, all else equal", () => {
    const candidates = [
      poi({ name: "Indoor Only", weatherAlign: "indoor" }),
      poi({ name: "Weatherproof", weatherAlign: "all" }),
    ];
    const result = recommendPois(candidates, { currentTime });
    expect(result[0].name).toBe("Weatherproof");
  });

  it("ranks cheaper options higher when a budget is set", () => {
    const candidates = [poi({ name: "Expensive", cost: 18 }), poi({ name: "Cheap", cost: 2 })];
    const result = recommendPois(candidates, { currentTime, budget: 20 });
    expect(result[0].name).toBe("Cheap");
  });

  it("returns an empty list rather than throwing when nothing survives", () => {
    const candidates = [poi({ weatherAlign: "outdoor" })];
    const result = recommendPois(candidates, { currentTime, weatherState: "Thunderstorm" });
    expect(result).toEqual([]);
  });
});
