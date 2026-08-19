jest.mock("@/lib/db");
jest.mock("@/lib/server/mailer");
// @react-email/render's Node implementation uses a dynamic import() under
// the hood, which this project's Jest transform (CommonJS, no
// --experimental-vm-modules) can't execute - it would throw for every
// recipient, silently, since notifyExpenseParticipants never inspects
// Promise.allSettled's rejected results. Mocking it here also draws the
// right unit-test boundary: this module's job is computing the correct
// props and calling sendMail, not verifying React Email's own HTML output.
jest.mock("@react-email/render");

import { render } from "@react-email/render";
import { mockDb } from "@/lib/testUtils/mockDb";
import { sendMail } from "@/lib/server/mailer";
import { notifyExpenseParticipants } from "./expenseNotifications";

const mockedSendMail = sendMail as jest.MockedFunction<typeof sendMail>;
const mockedRender = render as jest.MockedFunction<typeof render>;

const PLAN = { nameoftheplace: "Lisbon" };
const PLAN_SETTINGS = { currencyCode: "USD" };

function user(id: string, overrides: Partial<{ firstName: string | null; lastName: string | null; email: string }> = {}) {
  return { id, email: `${id}@example.com`, firstName: null, lastName: null, ...overrides };
}

describe("notifyExpenseParticipants", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSendMail.mockResolvedValue(undefined);
    // Returns the element's props as JSON rather than real HTML, so tests can
    // assert on exactly what expenseNotifications computed and handed to the
    // template (share amount, currency symbol, purpose) without depending on
    // React Email's actual markup.
    mockedRender.mockImplementation(async (element: any) => JSON.stringify(element.props));
    mockDb.plan.findUnique.mockResolvedValue(PLAN as any);
    mockDb.planSettings.findUnique.mockResolvedValue(PLAN_SETTINGS as any);
    mockDb.user.findUnique.mockResolvedValue(user("payer", { firstName: "Ada", lastName: "Lovelace" }) as any);
    mockDb.user.findMany.mockResolvedValue([user("friend1"), user("friend2")] as any);
  });

  it("does nothing when the only split is the acting user's own", async () => {
    await notifyExpenseParticipants({
      planId: "plan-1",
      purpose: "Dinner",
      amount: 40,
      paidByUserId: "payer",
      splits: [{ userId: "payer", amount: 40 }],
      actingUserId: "payer",
    });

    expect(mockDb.plan.findUnique).not.toHaveBeenCalled();
    expect(mockedSendMail).not.toHaveBeenCalled();
  });

  it("does nothing when splits is empty", async () => {
    await notifyExpenseParticipants({
      planId: "plan-1",
      purpose: "Dinner",
      amount: 40,
      paidByUserId: "payer",
      splits: [],
      actingUserId: "payer",
    });

    expect(mockedSendMail).not.toHaveBeenCalled();
  });

  it("excludes the acting user from recipients even when they're a split participant", async () => {
    mockDb.user.findMany.mockResolvedValue([user("friend1")] as any);

    await notifyExpenseParticipants({
      planId: "plan-1",
      purpose: "Dinner",
      amount: 40,
      paidByUserId: "payer",
      splits: [
        { userId: "payer", amount: 20 },
        { userId: "friend1", amount: 20 },
      ],
      actingUserId: "payer",
    });

    expect(mockDb.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["friend1"] } } })
    );
    expect(mockedSendMail).toHaveBeenCalledTimes(1);
  });

  it("de-duplicates a userId that appears more than once in splits", async () => {
    mockDb.user.findMany.mockResolvedValue([user("friend1")] as any);

    await notifyExpenseParticipants({
      planId: "plan-1",
      purpose: "Dinner",
      amount: 40,
      paidByUserId: "payer",
      splits: [
        { userId: "friend1", amount: 10 },
        { userId: "friend1", amount: 10 },
      ],
      actingUserId: "payer",
    });

    expect(mockDb.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["friend1"] } } })
    );
    expect(mockedSendMail).toHaveBeenCalledTimes(1);
  });

  it("sends one email per recipient, each addressed to that recipient", async () => {
    await notifyExpenseParticipants({
      planId: "plan-1",
      purpose: "Dinner",
      amount: 40,
      paidByUserId: "payer",
      splits: [
        { userId: "friend1", amount: 20 },
        { userId: "friend2", amount: 20 },
      ],
      actingUserId: "payer",
    });

    expect(mockedSendMail).toHaveBeenCalledTimes(2);
    const recipients = mockedSendMail.mock.calls.map((call) => call[0].to).sort();
    expect(recipients).toEqual(["friend1@example.com", "friend2@example.com"]);
  });

  it("builds the subject from the payer's display name and the plan's destination", async () => {
    await notifyExpenseParticipants({
      planId: "plan-1",
      purpose: "Dinner",
      amount: 40,
      paidByUserId: "payer",
      splits: [{ userId: "friend1", amount: 40 }],
      actingUserId: "payer",
    });

    expect(mockedSendMail.mock.calls[0][0].subject).toBe("Ada Lovelace added an expense in Lisbon");
  });

  it("falls back to first name only when no last name is set", async () => {
    mockDb.user.findUnique.mockResolvedValue(user("payer", { firstName: "Ada" }) as any);

    await notifyExpenseParticipants({
      planId: "plan-1",
      purpose: "Dinner",
      amount: 40,
      paidByUserId: "payer",
      splits: [{ userId: "friend1", amount: 40 }],
      actingUserId: "payer",
    });

    expect(mockedSendMail.mock.calls[0][0].subject).toContain("Ada added an expense");
  });

  it("falls back to the payer's email when neither first nor last name is set", async () => {
    mockDb.user.findUnique.mockResolvedValue(user("payer") as any);

    await notifyExpenseParticipants({
      planId: "plan-1",
      purpose: "Dinner",
      amount: 40,
      paidByUserId: "payer",
      splits: [{ userId: "friend1", amount: 40 }],
      actingUserId: "payer",
    });

    expect(mockedSendMail.mock.calls[0][0].subject).toContain("payer@example.com added an expense");
  });

  it("passes the expense purpose and each recipient's own share (not the total) to the template", async () => {
    await notifyExpenseParticipants({
      planId: "plan-1",
      purpose: "Beach dinner",
      amount: 100,
      paidByUserId: "payer",
      splits: [
        { userId: "friend1", amount: 30 },
        { userId: "friend2", amount: 70 },
      ],
      actingUserId: "payer",
    });

    const byRecipient = new Map<string, any>(
      mockedSendMail.mock.calls.map((call) => [call[0].to, JSON.parse(call[0].html)])
    );
    expect(byRecipient.get("friend1@example.com")).toMatchObject({ purpose: "Beach dinner", shareAmount: 30, totalAmount: 100 });
    expect(byRecipient.get("friend2@example.com")).toMatchObject({ purpose: "Beach dinner", shareAmount: 70, totalAmount: 100 });
  });

  it("resolves a known currency code to its symbol", async () => {
    mockDb.planSettings.findUnique.mockResolvedValue({ currencyCode: "EUR" } as any);

    await notifyExpenseParticipants({
      planId: "plan-1",
      purpose: "Dinner",
      amount: 40,
      paidByUserId: "payer",
      splits: [{ userId: "friend1", amount: 40 }],
      actingUserId: "payer",
    });

    expect(JSON.parse(mockedSendMail.mock.calls[0][0].html).currencySymbol).toBe("€");
  });

  it("falls back to the raw currency code when it isn't a recognised ISO code", async () => {
    mockDb.planSettings.findUnique.mockResolvedValue({ currencyCode: "ZZZ-NOT-REAL" } as any);

    await notifyExpenseParticipants({
      planId: "plan-1",
      purpose: "Dinner",
      amount: 40,
      paidByUserId: "payer",
      splits: [{ userId: "friend1", amount: 40 }],
      actingUserId: "payer",
    });

    expect(JSON.parse(mockedSendMail.mock.calls[0][0].html).currencySymbol).toBe("ZZZ-NOT-REAL");
  });

  it("does nothing (and does not send email) when the plan cannot be found", async () => {
    mockDb.plan.findUnique.mockResolvedValue(null);

    await notifyExpenseParticipants({
      planId: "missing-plan",
      purpose: "Dinner",
      amount: 40,
      paidByUserId: "payer",
      splits: [{ userId: "friend1", amount: 40 }],
      actingUserId: "payer",
    });

    expect(mockedSendMail).not.toHaveBeenCalled();
  });

  it("does nothing when the paying user cannot be found", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);

    await notifyExpenseParticipants({
      planId: "plan-1",
      purpose: "Dinner",
      amount: 40,
      paidByUserId: "ghost-user",
      splits: [{ userId: "friend1", amount: 40 }],
      actingUserId: "ghost-user",
    });

    expect(mockedSendMail).not.toHaveBeenCalled();
  });

  it("does not throw when the database lookup fails - failures here must never fail the request", async () => {
    mockDb.plan.findUnique.mockRejectedValue(new Error("connection reset"));

    await expect(
      notifyExpenseParticipants({
        planId: "plan-1",
        purpose: "Dinner",
        amount: 40,
        paidByUserId: "payer",
        splits: [{ userId: "friend1", amount: 40 }],
        actingUserId: "payer",
      })
    ).resolves.toBeUndefined();
  });

  it("does not throw, and still attempts every recipient, when one recipient's email fails to send", async () => {
    mockedSendMail.mockImplementation(async ({ to }) => {
      if (to === "friend1@example.com") throw new Error("SMTP down");
    });

    await expect(
      notifyExpenseParticipants({
        planId: "plan-1",
        purpose: "Dinner",
        amount: 40,
        paidByUserId: "payer",
        splits: [
          { userId: "friend1", amount: 20 },
          { userId: "friend2", amount: 20 },
        ],
        actingUserId: "payer",
      })
    ).resolves.toBeUndefined();

    expect(mockedSendMail).toHaveBeenCalledTimes(2);
  });
});
