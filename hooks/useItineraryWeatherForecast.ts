import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { WeatherForecastResponse } from "@/app/api/plans/[planId]/weather-forecast/route";

/**
 * Only meaningful for the plan owner's own editable view (see Itinerary.tsx's
 * `enabled` gating) - community/shared viewers aren't the ones who'd act on
 * a "reconsider this plan" nudge. Returns empty forecast/conflicts, not an
 * error, when the trip is outside Open-Meteo's forecast horizon.
 */
export function useItineraryWeatherForecast(planId: string, enabled: boolean) {
  const { data, error, isLoading } = useSWR<WeatherForecastResponse>(
    enabled ? `/api/plans/${planId}/weather-forecast` : null,
    fetcher
  );

  if (error) {
    // Previously swallowed silently - forecast/conflicts would just render
    // as empty with no indication anything failed. Surfacing it so a real
    // fetch failure (vs. "trip outside forecast horizon", which returns
    // data: {forecast: [], conflicts: []} successfully) is distinguishable.
    console.error(`weather-forecast fetch failed for plan ${planId}`, error);
  }

  return {
    forecast: data?.forecast ?? [],
    conflicts: data?.conflicts ?? [],
    isLoading,
    error,
  };
}
