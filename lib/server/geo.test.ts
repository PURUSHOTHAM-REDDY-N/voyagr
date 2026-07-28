import { haversineDistanceKm, estimateTransitMinutes, withTransitTimes } from "./geo";

describe("haversineDistanceKm", () => {
  it("is zero for the same point", () => {
    expect(haversineDistanceKm({ lat: 51.5, lng: -0.1 }, { lat: 51.5, lng: -0.1 })).toBe(0);
  });

  it("matches the known distance between London and Paris to within a few km", () => {
    // real-world great-circle distance is ~344km
    const km = haversineDistanceKm({ lat: 51.5074, lng: -0.1278 }, { lat: 48.8566, lng: 2.3522 });
    expect(km).toBeGreaterThan(330);
    expect(km).toBeLessThan(360);
  });

  it("is symmetric", () => {
    const a = { lat: 40.7128, lng: -74.006 };
    const b = { lat: 34.0522, lng: -118.2437 };
    expect(haversineDistanceKm(a, b)).toBeCloseTo(haversineDistanceKm(b, a), 6);
  });
});

describe("estimateTransitMinutes", () => {
  it("floors very short hops to the minimum transit time", () => {
    const minutes = estimateTransitMinutes({ lat: 48.8566, lng: 2.3522 }, { lat: 48.8567, lng: 2.3523 });
    expect(minutes).toBe(5);
  });

  it("scales up for longer distances", () => {
    const short = estimateTransitMinutes({ lat: 48.8566, lng: 2.3522 }, { lat: 48.86, lng: 2.36 });
    const long = estimateTransitMinutes({ lat: 48.8566, lng: 2.3522 }, { lat: 48.95, lng: 2.45 });
    expect(long).toBeGreaterThan(short);
  });

  it("never returns a fractional number of minutes", () => {
    const minutes = estimateTransitMinutes({ lat: 48.8566, lng: 2.3522 }, { lat: 48.87, lng: 2.37 });
    expect(Number.isInteger(minutes)).toBe(true);
  });
});

describe("withTransitTimes", () => {
  const activity = (name: string, coordinates?: { lat: number; lng: number } | null) => ({
    name,
    coordinates: coordinates ?? null,
  });

  it("stamps null on the very first activity of the day regardless of coordinates", () => {
    const result = withTransitTimes({
      morning: [activity("Breakfast", { lat: 48.85, lng: 2.35 })],
      afternoon: [],
      evening: [],
    });
    expect(result.morning[0].transitTimeMinutes).toBeNull();
  });

  it("computes transit time between two consecutive activities with coordinates", () => {
    const result = withTransitTimes({
      morning: [activity("A", { lat: 48.8566, lng: 2.3522 }), activity("B", { lat: 48.87, lng: 2.37 })],
      afternoon: [],
      evening: [],
    });
    expect(result.morning[0].transitTimeMinutes).toBeNull();
    expect(result.morning[1].transitTimeMinutes).toEqual(expect.any(Number));
    expect(result.morning[1].transitTimeMinutes).toBeGreaterThan(0);
  });

  it("stamps null when either endpoint is missing coordinates", () => {
    const result = withTransitTimes({
      morning: [activity("A", { lat: 48.8566, lng: 2.3522 }), activity("B", null)],
      afternoon: [activity("C", { lat: 48.87, lng: 2.37 })],
      evening: [],
    });
    expect(result.morning[1].transitTimeMinutes).toBeNull(); // B has no coordinates
    expect(result.afternoon[0].transitTimeMinutes).toBeNull(); // previous (B) has no coordinates
  });

  it("carries the sequence across morning -> afternoon -> evening, not resetting per block", () => {
    const result = withTransitTimes({
      morning: [activity("A", { lat: 48.85, lng: 2.35 })],
      afternoon: [activity("B", { lat: 48.86, lng: 2.36 })],
      evening: [activity("C", { lat: 48.87, lng: 2.37 })],
    });
    // Only the very first activity of the whole day (A) should be null
    expect(result.morning[0].transitTimeMinutes).toBeNull();
    expect(result.afternoon[0].transitTimeMinutes).not.toBeNull();
    expect(result.evening[0].transitTimeMinutes).not.toBeNull();
  });

  it("preserves the original activity fields alongside the new transitTimeMinutes", () => {
    const result = withTransitTimes({
      morning: [activity("Breakfast", { lat: 1, lng: 1 })],
      afternoon: [],
      evening: [],
    });
    expect(result.morning[0].name).toBe("Breakfast");
  });
});
