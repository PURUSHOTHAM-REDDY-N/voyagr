import { apiMutate } from "@/lib/fetcher";
import type { Plan } from "@prisma/client";

type PlanPartKey =
  | "abouttheplace"
  | "besttimetovisit"
  | "packingchecklist"
  | "localcuisinerecommendations"
  | "adventuresactivitiestodo"
  | "topplacestovisit";

export const updatePartOfPlan = (planId: string, key: PlanPartKey, data: unknown) =>
  apiMutate(`/api/plans/${planId}/part`, "PATCH", { key, data });

export const updatePlaceToVisit = (
  planId: string,
  lat: number,
  lng: number,
  placeName: string
) => apiMutate(`/api/plans/${planId}/places`, "POST", { lat, lng, placeName });

export const addDayInItinerary = (planId: string, itineraryDay: unknown) =>
  apiMutate(`/api/plans/${planId}/itinerary-days`, "POST", { itineraryDay });

export const deleteDayInItinerary = (planId: string, dayName: string) =>
  apiMutate(`/api/plans/${planId}/itinerary-days/${encodeURIComponent(dayName)}`, "DELETE");

export const reorderItineraryDay = (planId: string, fromIndex: number, toIndex: number) =>
  apiMutate(`/api/plans/${planId}/itinerary-days/reorder`, "PATCH", { fromIndex, toIndex });

export const regenerateItineraryDay = (planId: string, dayName: string) =>
  apiMutate<{ day: Plan["itinerary"][number] }>(
    `/api/plans/${planId}/itinerary-days/${encodeURIComponent(dayName)}/regenerate`,
    "POST"
  );

export const updateTravelDates = (planId: string, fromDate: number, toDate: number) =>
  apiMutate(`/api/plans/${planId}/settings/dates`, "PATCH", { fromDate, toDate });

export const updateCompanionId = (planId: string, companionId: string) =>
  apiMutate(`/api/plans/${planId}/settings/companion`, "PATCH", { companionId });

export const updateActivityPreferences = (planId: string, activityPreferencesIds: string[]) =>
  apiMutate(`/api/plans/${planId}/settings/activity-preferences`, "PATCH", {
    activityPreferencesIds,
  });

export const updatePlanPrivacy = (planId: string, isPublished: boolean) =>
  apiMutate(`/api/plans/${planId}/settings/privacy`, "PATCH", { isPublished });

export const addPreferredCurrency = (planId: string, currencyCode: string) =>
  apiMutate(`/api/plans/${planId}/settings/currency`, "PATCH", { currencyCode });

export const deletePlan = (planId: string) => apiMutate(`/api/plans/${planId}`, "DELETE");

export const revokeAccess = (accessId: string) => apiMutate(`/api/access/${accessId}`, "DELETE");

export const revokeInvite = (inviteId: string) => apiMutate(`/api/invites/${inviteId}`, "DELETE");

export const sendInvite = (planId: string, email: string) =>
  apiMutate(`/api/plans/${planId}/invites`, "POST", { email });

export const grantAccessByToken = (token: string) =>
  apiMutate<{ planId: string }>(`/api/invites/accept`, "POST", { token });

type ExpensePayload = {
  userId: string;
  amount: number;
  purpose: string;
  category: string;
  date: string;
  splits: { userId: string; amount: number }[];
};

export const createExpense = (planId: string, data: ExpensePayload) =>
  apiMutate(`/api/plans/${planId}/expenses`, "POST", data);

export const updateExpense = (expenseId: string, data: ExpensePayload) =>
  apiMutate(`/api/expenses/${expenseId}`, "PATCH", data);

export const deleteExpense = (expenseId: string) =>
  apiMutate(`/api/expenses/${expenseId}`, "DELETE");

export const deleteMultipleExpenses = (ids: string[]) =>
  apiMutate(`/api/expenses/bulk-delete`, "POST", { ids });

export const addFeedback = (planId: string | undefined, message: string, label: string) =>
  apiMutate(`/api/feedback`, "POST", { planId, message, label });

export const updateDisplayName = (firstName: string, lastName: string) =>
  apiMutate(`/api/users/me`, "PATCH", { firstName, lastName });
