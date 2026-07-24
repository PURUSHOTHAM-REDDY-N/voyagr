import Timeline from "@/components/Timeline";
import SectionWrapper from "@/components/sections/SectionWrapper";
import {AddIternaryDay} from "@/components/addNewItineraryDay/AddIternaryDay";
import {Button} from "@/components/ui/button";
import {Skeleton} from "@/components/ui/skeleton";
import type {Plan} from "@prisma/client";
import type {DailyForecast} from "@/lib/server/openMeteo";
import {Navigation, PlusCircle, PlusCircleIcon, PlusIcon} from "lucide-react";

type ItineraryProps = {
  itinerary: Plan["itinerary"] | undefined;
  planId: string;
  isLoading: boolean;
  allowEdit: boolean;
  fromDate?: number;
  forecast?: DailyForecast[];
};

const Itinerary = ({itinerary, planId, isLoading, allowEdit, fromDate, forecast}: ItineraryProps) => {
  return (
    <SectionWrapper id="itinerary">
      <div className="mb-2 flex justify-between items-center">
        <h2
          className="text-lg font-semibold
                tracking-wide flex items-center"
        >
          <Navigation className="mr-2" /> Itinerary
        </h2>
        {allowEdit && !isLoading && <AddIternaryDay planId={planId} />}
      </div>
      {!isLoading ? (
        <Timeline itinerary={itinerary} planId={planId} allowEdit={allowEdit} fromDate={fromDate} forecast={forecast} />
      ) : (
        <Skeleton className="w-full h-full" />
      )}
    </SectionWrapper>
  );
};

export default Itinerary;
