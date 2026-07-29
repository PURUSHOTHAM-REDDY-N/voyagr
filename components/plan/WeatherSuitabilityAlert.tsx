import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CloudRain } from "lucide-react";
import type { WeatherConflict } from "@/app/api/plans/[planId]/weather-forecast/route";

/**
 * "if the weather doesn't suit tell the user to choose other place" - only
 * renders once the forecast is actually in and flags a real clash between an
 * outdoor-leaning day and adverse weather; silent otherwise (no forecast yet,
 * or forecast is fine).
 */
const WeatherSuitabilityAlert = ({ conflicts }: { conflicts: WeatherConflict[] }) => {
  if (conflicts.length === 0) return null;

  return (
    <Alert variant="destructive">
      <CloudRain className="h-4 w-4" />
      <AlertTitle className="font-semibold text-sm">
        The forecast doesn&apos;t suit part of this plan
      </AlertTitle>
      <AlertDescription className="text-xs space-y-1">
        <ul className="list-disc pl-4">
          {conflicts.map((conflict) => (
            <li key={conflict.dayIndex}>
              <span className="font-medium">{conflict.dayTitle}</span> ({conflict.date}) is forecast{" "}
              {conflict.weatherState.toLowerCase()}, which doesn&apos;t suit: {conflict.conflictingActivities.join(", ")}
            </li>
          ))}
        </ul>
        <p>
          Use the <span className="font-medium">refresh icon</span> on that day below to regenerate just
          that day&apos;s plan around the forecast, or choose a different destination for these dates.
        </p>
      </AlertDescription>
    </Alert>
  );
};

export default WeatherSuitabilityAlert;
