import { render } from "@react-email/render";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/server/mailer";
import ExpenseAddedEmail from "@/emails/ExpenseAddedEmail";
import currencies from "@/lib/currencies.json";

function displayName(user: { firstName: string | null; lastName: string | null; email: string }) {
  return user.firstName ? user.firstName + (user.lastName ? ` ${user.lastName}` : "") : user.email;
}

/**
 * Emails everyone a split was made with, except the person who just added
 * the expense (they already know - they just did it). Failures here must
 * never fail the request: the expense is already saved by the time this
 * runs, so a broken SMTP config should just be logged, not surfaced as a
 * 500 on expense creation.
 */
export async function notifyExpenseParticipants({
  planId,
  purpose,
  amount,
  paidByUserId,
  splits,
  actingUserId,
}: {
  planId: string;
  purpose: string;
  amount: number;
  paidByUserId: string;
  splits: { userId: string; amount: number }[];
  actingUserId: string;
}) {
  const recipientIds = [...new Set(splits.map((s) => s.userId))].filter(
    (id) => id !== actingUserId
  );
  if (recipientIds.length === 0) return;

  try {
    const [plan, planSettings, paidByUser, recipients] = await Promise.all([
      db.plan.findUnique({ where: { id: planId }, select: { nameoftheplace: true } }),
      db.planSettings.findUnique({ where: { planId }, select: { currencyCode: true } }),
      db.user.findUnique({
        where: { id: paidByUserId },
        select: { email: true, firstName: true, lastName: true },
      }),
      db.user.findMany({
        where: { id: { in: recipientIds } },
        select: { id: true, email: true, firstName: true, lastName: true },
      }),
    ]);

    if (!plan || !paidByUser) return;

    const currencySymbol =
      currencies.find((c) => c.cc.includes(planSettings?.currencyCode ?? ""))?.symbol ??
      planSettings?.currencyCode ??
      "";

    const BASE_URL = process.env.HOSTING_URL ?? "https://travelplannerai.site";
    const expenseLink = `${BASE_URL}/plans/${planId}/expense-tracker`;
    const paidByName = displayName(paidByUser);

    await Promise.allSettled(
      recipients.map(async (recipient) => {
        const share = splits.find((s) => s.userId === recipient.id)?.amount ?? 0;
        const html = await render(
          <ExpenseAddedEmail
            projectName={plan.nameoftheplace}
            paidByName={paidByName}
            purpose={purpose}
            totalAmount={amount}
            shareAmount={share}
            currencySymbol={currencySymbol}
            expenseLink={expenseLink}
          />
        );

        await sendMail({
          to: recipient.email,
          subject: `${paidByName} added an expense in ${plan.nameoftheplace}`,
          html,
        });
      })
    );
  } catch (error) {
    console.error("Failed to send expense notification emails", error);
  }
}
