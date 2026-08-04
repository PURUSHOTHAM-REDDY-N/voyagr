// Deletes every user/plan this e2e suite created, run manually after the
// suite via `npx tsx e2e/cleanup.ts`. Never touches real accounts - every
// user this suite creates has an @voyagr-e2e-test.local email, and every
// plan it creates is named with the "[E2E]" prefix (see test-users.ts).
import { db } from "../lib/db";
import { E2E_EMAIL_DOMAIN, E2E_PLAN_PREFIX } from "./test-users";

async function main() {
  const testUsers = await db.user.findMany({
    where: { email: { endsWith: `@${E2E_EMAIL_DOMAIN}` } },
    select: { id: true, email: true },
  });
  const testUserIds = testUsers.map((u) => u.id);

  const testPlans = await db.plan.findMany({
    where: {
      OR: [{ nameoftheplace: { startsWith: E2E_PLAN_PREFIX } }, { userId: { in: testUserIds } }],
    },
    select: { id: true },
  });
  const testPlanIds = testPlans.map((p) => p.id);

  const [expenses, planSettings, access, invites, plans] = await Promise.all([
    db.expense.deleteMany({ where: { planId: { in: testPlanIds } } }),
    db.planSettings.deleteMany({ where: { planId: { in: testPlanIds } } }),
    db.access.deleteMany({ where: { planId: { in: testPlanIds } } }),
    db.invite.deleteMany({ where: { planId: { in: testPlanIds } } }),
    db.plan.deleteMany({ where: { id: { in: testPlanIds } } }),
  ]);
  const users = await db.user.deleteMany({ where: { id: { in: testUserIds } } });

  console.log({
    users: users.count,
    plans: plans.count,
    planSettings: planSettings.count,
    expenses: expenses.count,
    access: access.count,
    invites: invites.count,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
