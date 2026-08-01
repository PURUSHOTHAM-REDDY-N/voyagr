import { NextRequest } from "next/server";

jest.mock("@/auth");
jest.mock("@/lib/db");
jest.mock("@/lib/server/expenseNotifications");

import { auth } from "@/auth";
import { mockDb } from "@/lib/testUtils/mockDb";
import { notifyExpenseParticipants } from "@/lib/server/expenseNotifications";
import { GET, POST } from "./route";

const mockAuth = auth as jest.Mock;
const mockNotify = notifyExpenseParticipants as jest.Mock;

function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/plans/plan-1/expenses", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function makeGetRequest() {
  return new NextRequest("http://localhost/api/plans/plan-1/expenses");
}

const baseExpenseInput = {
  userId: "payer-1",
  amount: 60,
  purpose: "Team Dinner",
  category: "food",
  date: "2026-01-01",
};

describe("/api/plans/[planId]/expenses", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "caller-1" } });
    // caller-1 owns plan-1 by default; individual tests override this to
    // exercise the non-admin-but-collaborator and no-access paths.
    mockDb.plan.findUnique.mockResolvedValue({ id: "plan-1", userId: "caller-1" } as any);
  });

  describe("POST", () => {
    it("returns 401 when not signed in", async () => {
      mockAuth.mockResolvedValue(null);
      const res = await POST(makePostRequest(baseExpenseInput), { params: { planId: "plan-1" } });
      expect(res.status).toBe(401);
    });

    it("returns 404 when the plan doesn't exist", async () => {
      mockDb.plan.findUnique.mockResolvedValue(null);
      const res = await POST(makePostRequest(baseExpenseInput), { params: { planId: "missing" } });
      expect(res.status).toBe(404);
      expect(mockDb.expense.create).not.toHaveBeenCalled();
    });

    it("rejects a caller with no access to the plan (regression: this route used to have no access check at all)", async () => {
      mockDb.plan.findUnique.mockResolvedValue({ id: "plan-1", userId: "owner-1" } as any);
      mockDb.access.findFirst.mockResolvedValue(null);

      const res = await POST(makePostRequest(baseExpenseInput), { params: { planId: "plan-1" } });
      expect(res.status).toBe(403);
      expect(mockDb.expense.create).not.toHaveBeenCalled();
    });

    it("allows a non-admin collaborator (not just the plan owner) to add an expense", async () => {
      mockDb.plan.findUnique.mockResolvedValue({ id: "plan-1", userId: "owner-1" } as any);
      mockDb.access.findFirst.mockResolvedValue({ id: "a1", planId: "plan-1", userId: "caller-1" } as any);
      mockDb.expense.create.mockResolvedValue({ id: "e1", planId: "plan-1", ...baseExpenseInput, splits: [] } as any);

      const res = await POST(makePostRequest(baseExpenseInput), { params: { planId: "plan-1" } });
      expect(res.status).toBe(200);
    });

    it("defaults splits to an empty array when omitted", async () => {
      mockDb.expense.create.mockResolvedValue({ id: "e1", planId: "plan-1", ...baseExpenseInput, splits: [] } as any);

      await POST(makePostRequest(baseExpenseInput), { params: { planId: "plan-1" } });

      expect(mockDb.expense.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ splits: [] }) })
      );
    });

    it("does not send notifications when there are no splits", async () => {
      mockDb.expense.create.mockResolvedValue({ id: "e1", planId: "plan-1", ...baseExpenseInput, splits: [] } as any);

      await POST(makePostRequest(baseExpenseInput), { params: { planId: "plan-1" } });

      expect(mockNotify).not.toHaveBeenCalled();
    });

    it("notifies participants with the acting user excluded downstream, once a split exists", async () => {
      const splits = [
        { userId: "payer-1", amount: 30 },
        { userId: "other-1", amount: 30 },
      ];
      mockDb.expense.create.mockResolvedValue({ id: "e1", planId: "plan-1", ...baseExpenseInput, splits } as any);

      await POST(makePostRequest({ ...baseExpenseInput, splits }), { params: { planId: "plan-1" } });

      expect(mockNotify).toHaveBeenCalledWith({
        planId: "plan-1",
        purpose: "Team Dinner",
        amount: 60,
        paidByUserId: "payer-1",
        splits,
        actingUserId: "caller-1",
      });
    });

    it("relies entirely on notifyExpenseParticipants swallowing its own errors", async () => {
      // The route itself has no try/catch around the notify call - it's
      // notifyExpenseParticipants's own internal try/catch (see
      // lib/server/expenseNotifications.tsx) that keeps a broken SMTP
      // config from 500ing an otherwise-successful expense creation. This
      // test forces the mock to throw specifically to pin down that
      // contract: if a future change to notifyExpenseParticipants ever
      // stops swallowing its own errors, this route would start 500ing
      // despite the expense already being saved, and this test will catch
      // that regression.
      const splits = [{ userId: "payer-1", amount: 60 }];
      mockDb.expense.create.mockResolvedValue({ id: "e1", planId: "plan-1", ...baseExpenseInput, splits } as any);
      mockNotify.mockRejectedValue(new Error("SMTP down"));

      const res = await POST(makePostRequest({ ...baseExpenseInput, splits }), { params: { planId: "plan-1" } });

      expect(mockDb.expense.create).toHaveBeenCalled();
      expect(res.status).toBe(500);
    });
  });

  describe("GET", () => {
    it("returns 401 when not signed in", async () => {
      mockAuth.mockResolvedValue(null);
      const res = await GET(makeGetRequest(), { params: { planId: "plan-1" } });
      expect(res.status).toBe(401);
    });

    it("rejects a caller with no access to the plan (regression: this route used to have no access check at all)", async () => {
      mockDb.plan.findUnique.mockResolvedValue({ id: "plan-1", userId: "owner-1" } as any);
      mockDb.access.findFirst.mockResolvedValue(null);

      const res = await GET(makeGetRequest(), { params: { planId: "plan-1" } });
      expect(res.status).toBe(403);
      expect(mockDb.expense.findMany).not.toHaveBeenCalled();
    });

    it("attaches a resolved display name to each expense", async () => {
      mockDb.expense.findMany.mockResolvedValue([
        { id: "e1", planId: "plan-1", userId: "user-1", amount: 10, purpose: "Coffee" },
      ] as any);
      mockDb.user.findUnique.mockResolvedValue({ id: "user-1", firstName: "Ada", lastName: "Lovelace" } as any);

      const res = await GET(makeGetRequest(), { params: { planId: "plan-1" } });
      const body = await res.json();

      expect(body[0].whoSpent).toBe("Ada Lovelace");
    });

    it("falls back to 'Anonymous User' when the payer no longer exists", async () => {
      mockDb.expense.findMany.mockResolvedValue([
        { id: "e1", planId: "plan-1", userId: "deleted-user", amount: 10, purpose: "Coffee" },
      ] as any);
      mockDb.user.findUnique.mockResolvedValue(null);

      const res = await GET(makeGetRequest(), { params: { planId: "plan-1" } });
      const body = await res.json();

      expect(body[0].whoSpent).toBe("Anonymous User");
    });
  });
});
