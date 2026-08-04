import { chromium, type FullConfig } from "@playwright/test";
import { MAIN_USER } from "./test-users";

const STORAGE_STATE_PATH = "e2e/.auth/user.json";

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!;
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });

  await page.goto("/sign-up");
  await page.getByLabel("First name").fill(MAIN_USER.firstName);
  await page.getByLabel("Last name").fill(MAIN_USER.lastName);
  await page.getByLabel("Email").fill(MAIN_USER.email);
  await page.getByLabel("Password").fill(MAIN_USER.password);
  await page.getByRole("button", { name: "Create account" }).click();

  await page.waitForURL("**/dashboard", { timeout: 15_000 });

  await page.context().storageState({ path: STORAGE_STATE_PATH });
  await browser.close();
}
