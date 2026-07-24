import ItineraryDayHeader from "@/components/ItineraryDayHeader";
import type {Plan} from "@prisma/client";
import type {DailyForecast} from "@/lib/server/openMeteo";
import {formatDate} from "date-fns";
import {
  Lightbulb,
  Sun,
  Sunrise,
  Sunset,
  TrashIcon,
  Navigation,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudDrizzle,
  CloudFog,
  Home,
  TreePine,
  CloudSun,
} from "lucide-react";
import {ReactNode} from "react";

type TimelineProps = {
  itinerary: Plan["itinerary"] | undefined;
  planId: string;
  allowEdit: boolean;
  fromDate?: number;
  forecast?: DailyForecast[];
};

const WEATHER_STATE_ICON: Record<string, typeof Cloud> = {
  Clear: Sun,
  Clouds: Cloud,
  Rain: CloudRain,
  Drizzle: CloudDrizzle,
  Snow: CloudSnow,
  Thunderstorm: CloudLightning,
  Mist: CloudFog,
};

const DayForecastChip = ({day}: {day: DailyForecast}) => {
  const Icon = WEATHER_STATE_ICON[day.weatherState] ?? Cloud;
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted rounded-full px-2 py-1 ml-2">
      <Icon className="w-3.5 h-3.5" />
      <span>
        {day.weatherState}, {Math.round(day.tempMaxC)}°/{Math.round(day.tempMinC)}°
      </span>
    </div>
  );
};

const WEATHER_ALIGN_META: Record<string, {label: string; icon: typeof Home}> = {
  indoor: {label: "Indoor", icon: Home},
  outdoor: {label: "Outdoor", icon: TreePine},
  all: {label: "Indoor or outdoor", icon: CloudSun},
};

const WeatherAlignBadge = ({weatherAlign}: {weatherAlign: string}) => {
  const meta = WEATHER_ALIGN_META[weatherAlign.toLowerCase()];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-normal text-muted-foreground bg-background/70 border border-border rounded-full px-1.5 py-0.5 ml-1.5 align-middle">
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
};

const Timeline = ({itinerary, planId, allowEdit, fromDate, forecast}: TimelineProps) => {
  if (itinerary && itinerary.length === 0)
    return (
      <div className="flex justify-center items-center p-4">
        Click + Add a day to plan an itinerary
      </div>
    );

  const forecastByDate = new Map((forecast ?? []).map((day) => [day.date, day]));
  const totalDays = itinerary?.length ?? 0;

  // Index (and forecast date) is computed against the original array, before
  // filtering out empty days, so "Day 3" still lines up with fromDate + 2
  // days (and reordering/deleting targets the right array position) even if
  // an earlier day was dropped for having no activities.
  const filteredItinerary = itinerary
    ?.map((day, dayIndex) => {
      const dayDate = fromDate !== undefined ? new Date(fromDate + dayIndex * 24 * 60 * 60 * 1000) : undefined;
      const dateKey = dayDate?.toISOString().split("T")[0];
      return {
        day,
        dayIndex,
        dayForecast: dateKey ? forecastByDate.get(dateKey) : undefined,
        dateLabel: dayDate ? formatDate(dayDate, "EEE, MMM d") : undefined,
      };
    })
    .filter(({day}) => {
      const isMorningEmpty = day.activities.morning.length === 0;
      const isAfternoonEmpty = day.activities.afternoon.length === 0;
      const isEveningEmpty = day.activities.evening.length === 0;

      return !(isMorningEmpty && isAfternoonEmpty && isEveningEmpty);
    });

  return (
    <ol className="relative border-s border-gray-200 dark:border-foreground/40 ml-10 mt-5">
      {filteredItinerary?.map(({day, dayIndex, dayForecast, dateLabel}) => (
        <li className="mb-10 ms-6" key={day.title}>
          <span className="absolute flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full -start-3 ring-8 ring-white dark:ring-gray-900 dark:bg-blue-900">
            <svg
              className="w-2.5 h-2.5 text-blue-800 dark:text-blue-300"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M20 4a2 2 0 0 0-2-2h-2V1a1 1 0 0 0-2 0v1h-3V1a1 1 0 0 0-2 0v1H6V1a1 1 0 0 0-2 0v1H2a2 2 0 0 0-2 2v2h20V4ZM0 18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8H0v10Zm5-8h10a1 1 0 0 1 0 2H5a1 1 0 0 1 0-2Z" />
            </svg>
          </span>
          <div className="flex items-center flex-wrap gap-2">
            <div className="flex-1 min-w-0">
              <ItineraryDayHeader
                planId={planId}
                title={day.title}
                allowEdit={allowEdit}
                dayIndex={dayIndex}
                totalDays={totalDays}
                dateLabel={dateLabel}
              />
            </div>
            {dayForecast && <DayForecastChip day={dayForecast} />}
          </div>
          <div className="flex flex-col gap-5">
            <Activity
              activity={day.activities.morning}
              heading="Morning"
              icon={<Sunrise className="w-4 h-4 text-blue-500" />}
            />
            <Activity
              activity={day.activities.afternoon}
              heading="Afternoon"
              icon={<Sun className="w-4 h-4 text-yellow-500" />}
            />
            <Activity
              activity={day.activities.evening}
              heading="Evening"
              icon={<Sunset className="w-4 h-4 text-gray-600 dark:text-white" />}
            />
          </div>
        </li>
      ))}
    </ol>
  );
};

const Activity = ({
  activity,
  heading,
  icon,
}: {
  activity: {
    itineraryItem: string;
    briefDescription: string;
    contextualReasoning?: string | null;
    transitTimeMinutes?: number | null;
    weatherAlign?: string | null;
  }[];
  heading: string;
  icon: ReactNode;
}) => {
  if (activity.length == 0) return null;
  return (
    <div className="flex flex-col gap-2 shadow-md p-2 bg-muted rounded-sm">
      <h3
        className="text-sm leading-none
                  text-gray-600  w-max p-2 font-semibold
                  flex justify-center gap-2 items-center capitalize"
      >
        {icon}
        <div className="text-foreground">{heading}</div>
      </h3>
      <ul className="space-y-1 text-muted-foreground pl-2">
        {activity.map((act, index) => (
          <li key={index}>
            {!!act.transitTimeMinutes && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground/70 pl-1 pb-1">
                <Navigation className="w-3 h-3" />
                <span>~{act.transitTimeMinutes} min to get here</span>
              </div>
            )}
            <div className="w-full p-1 overflow-hidden">
              <span className=" text-foreground font-semibold">{act.itineraryItem}</span>
              {act.weatherAlign && <WeatherAlignBadge weatherAlign={act.weatherAlign} />}
              <p className="max-w-md md:max-w-full text-wrap whitespace-pre-line">
                {act.briefDescription}
              </p>
              {act.contextualReasoning && (
                <div className="flex items-start gap-1.5 mt-1.5 text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 rounded-md px-2 py-1.5">
                  <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{act.contextualReasoning}</span>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Timeline;
