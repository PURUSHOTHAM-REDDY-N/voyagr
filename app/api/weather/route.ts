import { NextRequest, NextResponse } from "next/server";
import { handleApiError, ApiError } from "@/lib/api-utils";
import { CurrentWeatherResponse } from "@/lib/types/WeatherResponse";

export async function GET(req: NextRequest) {
  try {
    const placeName = req.nextUrl.searchParams.get("placeName");
    if (!process.env.OPEN_WEATHER_MAP_API_KEY || !placeName) {
      return NextResponse.json(null);
    }

    const cityName = placeName.split(/[,-]/)[0].trim();
    if (!cityName || cityName.length <= 0) {
      throw new ApiError("Not able to construct cityname for weather, name:" + cityName);
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?q=${cityName}&appid=${process.env.OPEN_WEATHER_MAP_API_KEY}&units=metric`;
    const response = await fetch(url, { method: "GET", cache: "no-cache" });
    const data = (await response.json()) as CurrentWeatherResponse;

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
