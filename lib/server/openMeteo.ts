import { WeatherState } from "@/lib/server/recommendationEngine";

/**
 * Open-Meteo geocoding + forecast, free and keyless. Deliberately forecast-only:
 * no historical/typical-weather fallback for trip days beyond the forecast
 * horizon - those days are simply omitted from getDailyForecast's result, so
 * the weather-forecast route (and its UI) can decide to show nothing rather
 * than a misleading guess.
 */

// Open-Meteo's actual daily-forecast horizon.
const FORECAST_HORIZON_DAYS = 16;

export type DailyForecast = {
  date: string; // "YYYY-MM-DD"
  weatherState: WeatherState;
  tempMaxC: number;
  tempMinC: number;
};

// WMO weather codes, bucketed into the same {Clear, Clouds, Rain, Drizzle,
// Thunderstorm, Snow, Mist} vocabulary used elsewhere (recommendationEngine.ts,
// lib/server/weather.ts) so there's one consistent weather-state vocabulary
// across the app, not a second one specific to this provider.
const WEATHER_CODE_TO_STATE: Record<number, WeatherState> = {
  0: "Clear",
  1: "Clear",
  2: "Clouds",
  3: "Clouds",
  45: "Mist",
  48: "Mist",
  51: "Drizzle",
  53: "Drizzle",
  55: "Drizzle",
  56: "Drizzle",
  57: "Drizzle",
  61: "Rain",
  63: "Rain",
  65: "Rain",
  66: "Rain",
  67: "Rain",
  80: "Rain",
  81: "Rain",
  82: "Rain",
  71: "Snow",
  73: "Snow",
  75: "Snow",
  77: "Snow",
  85: "Snow",
  86: "Snow",
  95: "Thunderstorm",
  96: "Thunderstorm",
  99: "Thunderstorm",
};

function toDateOnly(date: Date): string {
  return date.toISOString().split("T")[0];
}

export async function geocodePlaceName(placeName: string): Promise<{ lat: number; lng: number } | undefined> {
  const cityName = placeName.split(/[,-]/)[0].trim();
  if (!cityName) return undefined;

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1`;
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) return undefined;

    const data = await response.json();
    const result = data?.results?.[0];
    if (!result) return undefined;

    return { lat: result.latitude, lng: result.longitude };
  } catch (error) {
    console.error(`failed to geocode "${placeName}" via Open-Meteo`, error);
    return undefined;
  }
}

/**
 * Daily forecast for the given date range, clamped to whatever portion of it
 * actually falls within Open-Meteo's forecast horizon (today .. +16 days).
 * Returns an empty array - not an error, not a guess - if the trip doesn't
 * overlap that window at all.
 */
export async function getDailyForecast(
  lat: number,
  lng: number,
  fromDate: Date,
  toDate: Date
): Promise<DailyForecast[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizonEnd = new Date(today);
  horizonEnd.setDate(horizonEnd.getDate() + FORECAST_HORIZON_DAYS);

  const rangeStart = fromDate > today ? fromDate : today;
  const rangeEnd = toDate < horizonEnd ? toDate : horizonEnd;

  if (rangeStart > rangeEnd) return [];

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&start_date=${toDateOnly(rangeStart)}&end_date=${toDateOnly(rangeEnd)}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`;
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) return [];

    const data = await response.json();
    const daily = data?.daily;
    if (!daily?.time?.length) return [];

    return daily.time.map((date: string, i: number) => ({
      date,
      weatherState: WEATHER_CODE_TO_STATE[daily.weathercode[i]] ?? "Clear",
      tempMaxC: daily.temperature_2m_max[i],
      tempMinC: daily.temperature_2m_min[i],
    }));
  } catch (error) {
    console.error(`failed to fetch Open-Meteo forecast for ${lat},${lng}`, error);
    return [];
  }
}
