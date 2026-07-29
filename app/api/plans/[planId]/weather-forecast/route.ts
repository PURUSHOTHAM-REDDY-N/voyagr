import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId, handleApiError } from "@/lib/api-utils";
import { validatePlanAccess } from "@/lib/server/plan";
import { geocodePlaceName, getDailyForecast, DailyForecast } from "@/lib/server/openMeteo";
import { isWeatherCompatible } from "@/lib/server/recommendationEngine";

export type WeatherConflict = {
  dayIndex: number;
  dayTitle: string;
  date: string;
  weatherState: string;
  conflictingActivities: string[];
};

export type WeatherForecastResponse = {
  forecast: DailyForecast[];
  conflicts: WeatherConflict[];
};

/**
 * Forecast-only, no historical fallback (see lib/server/openMeteo.ts): if the
 * trip's dates aren't within Open-Meteo's ~16 day forecast horizon yet, this
 * returns an empty forecast/conflicts, and the frontend shows nothing for it -
 * revisiting the plan page once the trip is close enough will pick it up.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const userId = await requireUserId();
    const { planId } = params;
    const { plan } = await validatePlanAccess(planId, userId);

    const planSettings = await db.planSettings.findUnique({ where: { planId } });
    if (!planSettings?.fromDate || !planSettings?.toDate) {
      return NextResponse.json<WeatherForecastResponse>({ forecast: [], conflicts: [] });
    }

    const coordinates = await geocodePlaceName(plan.nameoftheplace);
    if (!coordinates) {
      return NextResponse.json<WeatherForecastResponse>({ forecast: [], conflicts: [] });
    }

    const forecast = await getDailyForecast(coordinates.lat, coordinates.lng, planSettings.fromDate, planSettings.toDate);
    if (forecast.length === 0) {
      return NextResponse.json<WeatherForecastResponse>({ forecast: [], conflicts: [] });
    }

    const forecastByDate = new Map(forecast.map((day) => [day.date, day]));
    const conflicts: WeatherConflict[] = [];

    plan.itinerary.forEach((day, dayIndex) => {
      const date = new Date(planSettings.fromDate!);
      date.setDate(date.getDate() + dayIndex);
      const dateKey = date.toISOString().split("T")[0];

      const forecastDay = forecastByDate.get(dateKey);
      if (!forecastDay) return;

      const activities = [...day.activities.morning, ...day.activities.afternoon, ...day.activities.evening];
      const conflictingActivities = activities
        .filter((activity) => !isWeatherCompatible(activity.weatherAlign, forecastDay.weatherState))
        .map((activity) => activity.itineraryItem);

      if (conflictingActivities.length > 0) {
        conflicts.push({
          dayIndex,
          dayTitle: day.title,
          date: dateKey,
          weatherState: forecastDay.weatherState,
          conflictingActivities,
        });
      }
    });

    return NextResponse.json<WeatherForecastResponse>({ forecast, conflicts });
  } catch (error) {
    return handleApiError(error);
  }
}
