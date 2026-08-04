import { test, expect } from "@playwright/test";
import { pickDateRange, pickDestination } from "./helpers";
import { E2E_PLAN_PREFIX } from "./test-users";

test("creating an empty plan via the dashboard dialog redirects to the plan page and lists it on the dashboard", async ({ page }) => {
  const planName = `${E2E_PLAN_PREFIX} Paris Empty ${Date.now()}`;

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "open dialog button for Create Travel Plan" }).click();

  await pickDestination(page, "Paris");
  await page.getByRole("button", { name: "Pick Travel Dates" }).click();
  await pickDateRange(page, 14, 17);

  await page.getByRole("button", { name: "Create Your Plan" }).click();

  await page.waitForURL(/\/plans\/.+\/plan/, { timeout: 15_000 });
  const planId = page.url().match(/\/plans\/([^/]+)\//)![1];

  await page.goto("/dashboard");
  await expect(page.getByText("Paris")).toBeVisible();

  // stash for cleanup.ts (best-effort - a hard-coded prefix match handles
  // this either way, this is just a convenience trail)
  test.info().annotations.push({ type: "planId", description: planId });
});

test("generating an AI plan produces content without erroring (best-effort - depends on the external Ollama tunnel)", async ({ page }) => {
  test.setTimeout(220_000);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "open dialog button for Create Travel Plan" }).click();

  await pickDestination(page, "Kyoto");
  await page.getByRole("button", { name: "Pick Travel Dates" }).click();
  await pickDateRange(page, 20, 21);

  await page.getByRole("button", { name: "Generate AI Plan" }).click();

  await page.waitForURL(/\/plans\/.+\/plan/, { timeout: 20_000 });
  // The destination name (e.g. "Kyoto") renders immediately from the plan
  // record, well before AI generation finishes - it's not proof generation
  // actually completed. "Day 1" only appears once the itinerary section has
  // real generated content, so it's a meaningful completion signal. Give it
  // a generous window since generation is chunked (2 days/request) against
  // the external, occasionally slow Ollama tunnel.
  await expect(page.getByText("Day 1")).toBeVisible({ timeout: 180_000 });
});
