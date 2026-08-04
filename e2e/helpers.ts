import { Page, APIRequestContext, expect } from "@playwright/test";
import { format, addDays } from "date-fns";

// react-day-picker (v8) gives each day's clickable element role="gridcell"
// (not "button" - see node_modules/react-day-picker/dist/index.js's
// buttonProps, which deliberately overrides the role for grid semantics)
// and no aria-label, just the bare day-of-month number as its text/name.
// The month grid itself is aria-labelledby its caption, e.g. "August 2026".
async function clickDay(page: Page, date: Date) {
  const grid = page.getByRole("grid", { name: format(date, "MMMM yyyy") });
  // Calendars pad leading/trailing weeks with days from adjacent months
  // (react-day-picker's "day-outside" cells) - on a single-month view these
  // share the same grid and can collide with the real in-month day sharing
  // the same day-of-month number (e.g. Aug 5 and the padded Sep 5).
  const cell = grid
    .getByRole("gridcell", { name: format(date, "d"), exact: true })
    .and(page.locator(":not(.day-outside)"));
  await cell.click();
}

/** Picks a `fromOffset`..`toOffset` day trip (days from today) in an already-open date-range Calendar popover. */
export async function pickDateRange(page: Page, fromOffsetDays: number, toOffsetDays: number) {
  const from = addDays(new Date(), fromOffsetDays);
  const to = addDays(new Date(), toOffsetDays);
  await clickDay(page, from);
  await clickDay(page, to);
}

/** Picks a single date (e.g. the expense form's "On" field) in an already-open Calendar popover. */
export async function pickSingleDate(page: Page, date: Date) {
  await clickDay(page, date);
}

/** Types a destination into the Google Places autocomplete and picks the first suggestion. */
export async function pickDestination(page: Page, query: string) {
  // The Places JS library loads asynchronously on first use - typing before
  // it's ready means getPlacePredictions() silently has nothing to call.
  await page.waitForFunction(() => (window as any).google?.maps?.places, undefined, {
    timeout: 20_000,
  });

  const input = page.getByPlaceholder("Search for your destination city...");
  await input.pressSequentially(query, { delay: 50 });
  const firstSuggestion = page.locator("li", { hasText: query }).first();
  await firstSuggestion.waitFor({ state: "visible", timeout: 20_000 });
  await firstSuggestion.click();
}

/** Creates a plan directly via the API (bypassing the UI dialog + Places autocomplete) for specs that need a plan to exist but aren't testing plan creation itself. */
export async function createPlanViaApi(
  request: APIRequestContext,
  { name, days = 3 }: { name: string; days?: number }
): Promise<string> {
  const fromDate = addDays(new Date(), 10);
  const toDate = addDays(fromDate, days - 1);

  const res = await request.post("/api/plans", {
    data: {
      placeName: name,
      noOfDays: String(days),
      activityPreferences: [],
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
      isGeneratedUsingAI: false,
    },
  });
  expect(res.ok(), `createPlanViaApi failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  const { planId } = await res.json();
  return planId as string;
}
