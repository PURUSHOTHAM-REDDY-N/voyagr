// Shared identity for the "main" test user used by most specs (created once
// in global-setup.ts, reused via storageState). All e2e-created accounts use
// this email domain and plans use this name prefix, so cleanup.ts can find
// and delete everything this suite created without touching real user data.
// Playwright's global-setup and each spec file's worker run in *separate*
// processes, so a plain `Date.now()` here would produce a different value
// per process. E2E_RUN_ID is exported once by the shell before invoking
// `playwright test` so every process agrees on the same identity.
const RUN_ID = process.env.E2E_RUN_ID;
if (!RUN_ID) {
  throw new Error("E2E_RUN_ID must be set before running the e2e suite (see e2e/run.sh)");
}

export const E2E_EMAIL_DOMAIN = "voyagr-e2e-test.local";
export const E2E_PLAN_PREFIX = "[E2E]";

export const MAIN_USER = {
  email: `main-${RUN_ID}@${E2E_EMAIL_DOMAIN}`,
  password: "e2e-test-password-123",
  firstName: "E2E",
  lastName: "Main",
};
