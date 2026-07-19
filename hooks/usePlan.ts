import useSWR from "swr";
import { fetcher, FetchError } from "@/lib/fetcher";

const usePlan = (planId: string, isNewPlan: boolean, isPublic: boolean) => {
  const { data: plan, error, isLoading } = useSWR(
    planId ? `/api/plans/${planId}?isPublic=${isPublic}` : null,
    fetcher,
    {
      refreshInterval: (data: any) => {
        if (!data) return 0;
        const stillGenerating = Object.values(data.contentGenerationState).some(
          (value) => value === false
        );
        return stillGenerating ? 3000 : 0;
      },
    }
  );

  if (error) {
    const errorMessage =
      error instanceof FetchError ? error.message : "Something went wrong!";
    return {
      shouldShowAlert: false,
      plan: null,
      isLoading: false,
      error: errorMessage,
    };
  }

  const shouldShowAlert =
    plan?.isGeneratedUsingAI &&
    isNewPlan &&
    plan &&
    Object.values(plan.contentGenerationState).some((value) => value === false)
      ? true
      : false;

  return {
    shouldShowAlert,
    plan,
    isLoading,
  };
};

export default usePlan;
