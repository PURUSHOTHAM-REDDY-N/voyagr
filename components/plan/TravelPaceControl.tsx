import { TRAVEL_PACE_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const TravelPaceControl = ({
  value,
  onChange,
  className,
}: {
  value: string | undefined;
  onChange: (paceId: string) => void;
  className?: string;
}) => {
  return (
    <div className={cn("flex gap-2 flex-wrap", className)}>
      {TRAVEL_PACE_OPTIONS.map((pace) => (
        <label
          key={pace.id}
          className="flex-1 p-1 opacity-50 hover:opacity-100 dark:opacity-40 dark:hover:opacity-100
                  has-[:checked]:bg-blue-100 has-[:checked]:opacity-100 dark:has-[:checked]:opacity-100
                  duration-200 transition-all ease-in-out
                  rounded-md cursor-pointer select-none
                  flex justify-center items-center
                  bg-gray-100 has-[:checked]:shadow-sm dark:bg-transparent dark:border dark:border-foreground
                  "
        >
          <input
            type="radio"
            className="hidden"
            name="travelPace"
            checked={value == pace.id}
            onChange={(e) => {
              if (e.target.checked) {
                onChange(pace.id);
              }
            }}
          />
          <pace.icon className="w-5 h-5 pr-1" />
          <span>{pace.displayName}</span>
        </label>
      ))}
    </div>
  );
};

export default TravelPaceControl;
