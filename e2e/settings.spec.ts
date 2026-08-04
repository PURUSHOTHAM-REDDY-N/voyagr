import { test, expect } from "@playwright/test";
import { createPlanViaApi } from "./helpers";
import { E2E_PLAN_PREFIX, MAIN_USER } from "./test-users";

test.describe("plan settings", () => {
  let planId: string;

  test.beforeAll(async ({ request }) => {
    planId = await createPlanViaApi(request, { name: `${E2E_PLAN_PREFIX} Settings Test ${Date.now()}` });
  });

  test("changing the preferred currency persists across reloads", async ({ page }) => {
    await page.goto(`/plans/${planId}/settings`);

    const currencySection = page.locator("article", { hasText: "Preffered Currency" });
    await currencySection.getByRole("combobox").click();
    await page.getByRole("option", { name: /^EUR/ }).click();
    await currencySection.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("Your preferences have been saved!").first()).toBeVisible();

    await page.reload();
    await expect(currencySection.getByRole("combobox")).toContainText("EUR");
  });
});

test.describe("collaborate / invites", () => {
  let planId: string;

  test.beforeAll(async ({ request }) => {
    planId = await createPlanViaApi(request, { name: `${E2E_PLAN_PREFIX} Collaborate Test ${Date.now()}` });
  });

  test("inviting yourself is rejected with a clear error", async ({ page }) => {
    await page.goto(`/plans/${planId}/collaborate`);

    await page.getByLabel("Email").fill(MAIN_USER.email);
    await page.getByRole("button", { name: "Invite" }).click();

    await expect(page.getByText("You can not invite yourself to join this Plan").first()).toBeVisible();
  });
});
