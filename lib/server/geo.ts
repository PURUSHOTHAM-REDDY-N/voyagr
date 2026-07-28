/**
 * Deterministic transit-time estimation between itinerary stops - the
 * "built-in travel time allocations" feature. No routing API is
 * integrated (see the dissertation correction notes: the Google Maps
 * Distance Matrix API is not currently wired up), so this estimates from
 * straight-line (Haversine) distance and an assumed average city travel
 * speed, rather than trusting the LLM to invent a plausible-sounding number.
 */

const EARTH_RADIUS_KM = 6371;
// Blended walking/public-transit/taxi speed for short in-city hops. Deliberately
// conservative - this is an estimate for pacing an itinerary, not turn-by-turn routing.
const ASSUMED_SPEED_KMH = 25;
const MIN_TRANSIT_MINUTES = 5;

export type Coordinates = { lat: number; lng: number };

export function haversineDistanceKm(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function estimateTransitMinutes(a: Coordinates, b: Coordinates): number {
  const distanceKm = haversineDistanceKm(a, b);
  return Math.max(MIN_TRANSIT_MINUTES, Math.round((distanceKm / ASSUMED_SPEED_KMH) * 60));
}

type ActivityWithCoordinates = {
  coordinates?: Coordinates | null;
  [key: string]: unknown;
};

/**
 * Walks a single day's morning -> afternoon -> evening activities in order
 * and stamps transitTimeMinutes on each one (null for the first activity of
 * the day, or any activity missing coordinates).
 */
export function withTransitTimes<T extends ActivityWithCoordinates>(day: {
  morning: T[];
  afternoon: T[];
  evening: T[];
}): { morning: (T & { transitTimeMinutes: number | null })[]; afternoon: (T & { transitTimeMinutes: number | null })[]; evening: (T & { transitTimeMinutes: number | null })[] } {
  const sequence = [...day.morning, ...day.afternoon, ...day.evening];
  const transitTimes: (number | null)[] = sequence.map((activity, index) => {
    if (index === 0) return null;
    const previous = sequence[index - 1];
    if (!previous.coordinates || !activity.coordinates) return null;
    return estimateTransitMinutes(previous.coordinates, activity.coordinates);
  });

  let cursor = 0;
  const stamp = (activities: T[]) =>
    activities.map((activity) => ({ ...activity, transitTimeMinutes: transitTimes[cursor++] }));

  return {
    morning: stamp(day.morning),
    afternoon: stamp(day.afternoon),
    evening: stamp(day.evening),
  };
}
