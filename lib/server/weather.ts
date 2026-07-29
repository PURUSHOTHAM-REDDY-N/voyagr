/**
 * Server-side counterpart to app/api/weather/route.ts (which serves the
 * browser-facing Weather widget). This is used during plan generation to
 * feed the live weather condition into the recommendation engine's
 * fweather() pass - it only needs the condition group (e.g. "Rain"), not the
 * full OpenWeatherMap payload the widget renders.
 */
export async function getCurrentWeatherState(placeName: string): Promise<string | undefined> {
  if (!process.env.OPEN_WEATHER_MAP_API_KEY) return undefined;

  const cityName = placeName.split(/[,-]/)[0].trim();
  if (!cityName) return undefined;

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityName)}&appid=${process.env.OPEN_WEATHER_MAP_API_KEY}&units=metric`;
    const response = await fetch(url, { method: "GET", cache: "no-cache" });
    if (!response.ok) return undefined;

    const data = await response.json();
    return data?.weather?.[0]?.main as string | undefined;
  } catch (error) {
    console.error(`failed to fetch weather for recommendation engine, place: ${placeName}`, error);
    return undefined;
  }
}
