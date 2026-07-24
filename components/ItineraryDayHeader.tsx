"use client";

import {Button} from "@/components/ui/button";
import {deleteDayInItinerary, regenerateItineraryDay, reorderItineraryDay} from "@/lib/client/plan";
import {useToast} from "@/components/ui/use-toast";
import {ChevronDown, ChevronUp, RefreshCw, TrashIcon} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {useState} from "react";
import {useSWRConfig} from "swr";
import {cn} from "@/lib/utils";

type ItineraryDayHeaderProps = {
  title: string;
  planId: string;
  allowEdit: boolean;
  dayIndex: number;
  totalDays: number;
  dateLabel?: string;
};

export default function ItineraryDayHeader({
  title,
  planId,
  allowEdit,
  dayIndex,
  totalDays,
  dateLabel,
}: ItineraryDayHeaderProps) {
  const [open, setOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const {mutate} = useSWRConfig();
  const {toast} = useToast();

  const refreshPlan = () =>
    Promise.all([
      mutate(`/api/plans/${planId}?isPublic=false`),
      mutate(`/api/plans/${planId}/weather-forecast`),
    ]);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      await regenerateItineraryDay(planId, title);
      await refreshPlan();
      toast({title: `${title} regenerated`});
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Couldn't regenerate this day",
        description: "Please try again.",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDayInItinerary(planId, title);
      await refreshPlan();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Couldn't delete this day",
        description: "Please try again.",
      });
    }
  };

  const handleMove = async (direction: "up" | "down") => {
    const toIndex = direction === "up" ? dayIndex - 1 : dayIndex + 1;
    if (toIndex < 0 || toIndex >= totalDays) return;

    setIsReordering(true);
    try {
      await reorderItineraryDay(planId, dayIndex, toIndex);
      await refreshPlan();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Couldn't reorder days",
        description: "Please try again.",
      });
    } finally {
      setIsReordering(false);
    }
  };

  return (
    <div className="flex justify-between items-baseline mb-2 text-lg font-bold leading-2 text-foreground ">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span>{title}</span>
        {dateLabel && <span className="text-xs font-normal text-muted-foreground">{dateLabel}</span>}
      </div>
      {allowEdit && (
        <div className="flex items-center gap-1">
          <div className="flex flex-col">
            <Button
              size="icon"
              variant="ghost"
              className="p-0 h-4 rounded-full bg-background/50"
              disabled={isReordering || dayIndex === 0}
              onClick={() => handleMove("up")}
              aria-label={`Move ${title} earlier`}
              title="Move this day earlier"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="p-0 h-4 rounded-full bg-background/50"
              disabled={isReordering || dayIndex === totalDays - 1}
              onClick={() => handleMove("down")}
              aria-label={`Move ${title} later`}
              title="Move this day later"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="p-1 rounded-full bg-background/50"
            disabled={isRegenerating}
            onClick={handleRegenerate}
            aria-label={`Regenerate ${title}`}
            title="Regenerate this day"
          >
            <RefreshCw className={cn("h-5 w-5", isRegenerating && "animate-spin")} />
          </Button>
          <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger aria-label={`Delete ${title}`}>
              <Button
                asChild
                size="icon"
                variant="ghost"
                className="p-1 rounded-full bg-background/50"
                onClick={() => setOpen(true)}
              >
                <TrashIcon className="h-6 w-6 text-red-500 dark:text-foreground dark:hover:text-red-500 hover:scale-105 transition-all duration-300" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the day from your
                  Itinerary, and the remaining days will be renumbered.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
