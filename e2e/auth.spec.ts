import { test, expect } from "@playwright/test";
import { E2E_EMAIL_DOMAIN } from "./test-users";

// Fresh, unauthenticated context per test - overrides the storageState the
// rest of the suite reuses, since these tests exercise the sign-up/sign-in
// flow itself and need to start logged out.
test.use({ storageState: { cookies: [], origins: [] } });

test("landing page loads for a logged-out visitor", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Voyagr|Travel/i);
  await expect(page.getByRole("link", { name: "Sign in" }).or(page.getByRole("button", { name: "Sign in" }))).toBeVisible();
});

test("sign-up creates an account, signs in, and reaches the dashboard", async ({ page }) => {
  const email = `signup-${test.info().workerIndex}-${Date.now()}@${E2E_EMAIL_DOMAIN}`;

  await page.goto("/sign-up");
  await page.getByLabel("First name").fill("E2E");
  await page.getByLabel("Last name").fill("Signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("e2e-test-password-123");
  await page.getByRole("button", { name: "Create account" }).click();

  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible();

  // sign out
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL("**/");

  // sign back in with the same credentials
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("e2e-test-password-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible();
});

test("sign-in rejects a wrong password", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(`nonexistent-${Date.now()}@${E2E_EMAIL_DOMAIN}`);
  await page.getByLabel("Password").fill("totally-wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Couldn't sign in").first()).toBeVisible();
});
