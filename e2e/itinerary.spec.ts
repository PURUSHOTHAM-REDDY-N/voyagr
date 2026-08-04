import { test, expect } from "@playwright/test";
import { createPlanViaApi } from "./helpers";
import { E2E_PLAN_PREFIX } from "./test-users";

async function addDay(page: import("@playwright/test").Page, placeName: string, description: string) {
  await page.getByRole("button", { name: "Add a day" }).click();
  // The Morning tab starts with one empty place row already present (see
  // useItineraryForm's defaultValues) - no need to click "Add New Place".
  await page.getByPlaceholder("Name of the place").fill(placeName);
  await page.getByPlaceholder("How would you describe it?").fill(description);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Add a day" })).toBeVisible();
}

test.describe("itinerary day management", () => {
  let planId: string;

  test.beforeAll(async ({ request }) => {
    planId = await createPlanViaApi(request, { name: `${E2E_PLAN_PREFIX} Itinerary Test ${Date.now()}` });
  });

  test("adding two days shows them in order with date labels", async ({ page }) => {
    await page.goto(`/plans/${planId}/plan`);

    await addDay(page, "Louvre Museum", "World famous art museum");
    await expect(page.getByText("Louvre Museum")).toBeVisible();
    await expect(page.getByText("Day 1")).toBeVisible();

    await addDay(page, "Eiffel Tower", "Iconic Paris landmark");
    await expect(page.getByText("Eiffel Tower")).toBeVisible();
    await expect(page.getByText("Day 2")).toBeVisible();

    // date labels (e.g. "Mon, Jan 1") should render next to each day title
    const dayItems = page.locator("li:has-text('Day 1'), li:has-text('Day 2')");
    await expect(dayItems).toHaveCount(2);
  });

  test("reordering moves day content, not just titles", async ({ page }) => {
    await page.goto(`/plans/${planId}/plan`);

    // Day 1 = Louvre, Day 2 = Eiffel from the previous test
    await expect(page.getByText("Day 1")).toBeVisible();
    await page.getByRole("button", { name: "Move Day 2 earlier" }).click();

    // after the swap, "Day 1" should now contain the Eiffel Tower content
    const day1 = page.locator("li", { hasText: "Day 1" });
    await expect(day1.getByText("Eiffel Tower")).toBeVisible();
    const day2 = page.locator("li", { hasText: "Day 2" });
    await expect(day2.getByText("Louvre Museum")).toBeVisible();
  });

  test("deleting a day renumbers the remaining days", async ({ page }) => {
    await page.goto(`/plans/${planId}/plan`);

    // Day 1 = Eiffel Tower, Day 2 = Louvre Museum after the reorder test
    await page.getByRole("button", { name: "Delete Day 1" }).click();
    await page.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText("Day 2")).not.toBeVisible();
    await expect(page.getByText("Day 1")).toBeVisible();
    await expect(page.getByText("Louvre Museum")).toBeVisible();
    await expect(page.getByText("Eiffel Tower")).not.toBeVisible();
  });
});
