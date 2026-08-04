import { test, expect } from "@playwright/test";
import { createPlanViaApi, pickSingleDate } from "./helpers";
import { E2E_PLAN_PREFIX } from "./test-users";

test.describe("expense tracker + splitwise splitting", () => {
  let planId: string;

  test.beforeAll(async ({ request }) => {
    planId = await createPlanViaApi(request, { name: `${E2E_PLAN_PREFIX} Expenses Test ${Date.now()}` });
  });

  test("adding an expense with a split shows it in the table and the balances card", async ({ page }) => {
    await page.goto(`/plans/${planId}/expense-tracker`);

    await page.getByRole("button", { name: "Add a New Expense" }).click();

    await page.getByLabel("For").fill("Team Dinner");
    await page.getByLabel(/Who Paid/).click();
    await page.getByRole("option", { name: /\(You\)/ }).click();
    await page.getByLabel(/Category/).click();
    await page.getByRole("option", { name: "Food" }).click();
    await page.getByLabel(/Amount/).fill("60");
    await page.getByLabel("On", { exact: true }).click();
    await pickSingleDate(page, new Date());

    // split defaults to "Equally" across all collaborators (just this user
    // on a freshly created solo plan) - no extra interaction needed.
    await page.getByRole("button", { name: "Add Expense" }).click();

    await expect(page.getByText("Team Dinner")).toBeVisible();
    await expect(page.getByText(/60\.00/)).toBeVisible();

    // a single-participant split always nets to zero - the balances card
    // should render but report everyone as settled up.
    await expect(page.getByText("Balances")).toBeVisible();
    await expect(page.getByText("Everyone's settled up.")).toBeVisible();
  });

  test("editing an expense updates the amount", async ({ page }) => {
    await page.goto(`/plans/${planId}/expense-tracker`);

    await page.getByText("Team Dinner").click();
    await page.getByLabel(/Amount/).fill("75");
    // Editing reconstructs the split as fixed "exact" amounts from what was
    // saved before (60 total) - changing the top-line amount without
    // touching the split leaves it inconsistent (75 vs. a 60 split), which
    // the form correctly rejects. Switch to "Equally" so it recomputes off
    // the new amount instead of fighting stale exact values.
    await page.getByRole("tab", { name: "Equally" }).click();
    await page.getByRole("button", { name: "Update Expense" }).click();

    await expect(page.getByText(/75\.00/)).toBeVisible();
  });

  test("deleting an expense removes it from the table", async ({ page }) => {
    await page.goto(`/plans/${planId}/expense-tracker`);

    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("menuitem", { name: "Delete Expense" }).click();

    await expect(page.getByText("Team Dinner")).not.toBeVisible();
    await expect(page.getByText("You haven't added any Expenses yet!")).toBeVisible();
  });
});
