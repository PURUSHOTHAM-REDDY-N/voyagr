import { NextRequest } from "next/server";

jest.mock("@/auth");
jest.mock("@/lib/db");

import { auth } from "@/auth";
import { mockDb } from "@/lib/testUtils/mockDb";
import { PATCH, DELETE } from "./route";

const mockAuth = auth as jest.Mock;

function makePatchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/expenses/expense-1", { method: "PATCH", body: JSON.stringify(body) });
}
function makeDeleteRequest() {
  return new NextRequest("http://localhost/api/expenses/expense-1", { method: "DELETE" });
}

const existingExpense = { id: "expense-1", planId: "plan-1", userId: "payer-1", amount: 60 };

describe("PATCH /api/expenses/[expenseId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "caller-1" } });
    mockDb.expense.findUnique.mockResolvedValue(existingExpense as any);
    mockDb.plan.findUnique.mockResolvedValue({ id: "plan-1", userId: "caller-1" } as any);
  });

  it("returns 401 when not signed in", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PATCH(makePatchRequest({ amount: 10 }), { params: { expenseId: "expense-1" } });
    expect(res.status).toBe(401);
  });

  it("returns 404 when the expense doesn't exist", async () => {
    mockDb.expense.findUnique.mockResolvedValue(null);
    const res = await PATCH(makePatchRequest({ amount: 10 }), { params: { expenseId: "missing" } });
    expect(res.status).toBe(404);
    expect(mockDb.expense.update).not.toHaveBeenCalled();
  });

  it("rejects a caller with no access to the expense's plan (regression: this route used to have no access check at all)", async () => {
    mockDb.plan.findUnique.mockResolvedValue({ id: "plan-1", userId: "owner-1" } as any);
    mockDb.access.findFirst.mockResolvedValue(null);

    const res = await PATCH(makePatchRequest({ amount: 10 }), { params: { expenseId: "expense-1" } });
    expect(res.status).toBe(403);
    expect(mockDb.expense.update).not.toHaveBeenCalled();
  });

  it("defaults splits to an empty array when omitted", async () => {
    mockDb.expense.update.mockResolvedValue({ id: "expense-1" } as any);

    await PATCH(
      makePatchRequest({ amount: 75, purpose: "Dinner", category: "food", date: "2026-01-01", userId: "payer-1" }),
      { params: { expenseId: "expense-1" } }
    );

    expect(mockDb.expense.update).toHaveBeenCalledWith({
      where: { id: "expense-1" },
      data: { amount: 75, purpose: "Dinner", category: "food", date: "2026-01-01", userId: "payer-1", splits: [] },
    });
  });

  it("passes through a provided splits array unchanged", async () => {
    const splits = [{ userId: "payer-1", amount: 75 }];
    mockDb.expense.update.mockResolvedValue({ id: "expense-1" } as any);

    await PATCH(
      makePatchRequest({ amount: 75, purpose: "Dinner", category: "food", date: "2026-01-01", userId: "payer-1", splits }),
      { params: { expenseId: "expense-1" } }
    );

    const call = mockDb.expense.update.mock.calls[0][0] as any;
    expect(call.data.splits).toEqual(splits);
  });
});

describe("DELETE /api/expenses/[expenseId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "caller-1" } });
    mockDb.expense.findUnique.mockResolvedValue(existingExpense as any);
    mockDb.plan.findUnique.mockResolvedValue({ id: "plan-1", userId: "caller-1" } as any);
  });

  it("returns 401 when not signed in", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await DELETE(makeDeleteRequest(), { params: { expenseId: "expense-1" } });
    expect(res.status).toBe(401);
    expect(mockDb.expense.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when the expense doesn't exist", async () => {
    mockDb.expense.findUnique.mockResolvedValue(null);
    const res = await DELETE(makeDeleteRequest(), { params: { expenseId: "missing" } });
    expect(res.status).toBe(404);
  });

  it("rejects a caller with no access to the expense's plan", async () => {
    mockDb.plan.findUnique.mockResolvedValue({ id: "plan-1", userId: "owner-1" } as any);
    mockDb.access.findFirst.mockResolvedValue(null);

    const res = await DELETE(makeDeleteRequest(), { params: { expenseId: "expense-1" } });
    expect(res.status).toBe(403);
    expect(mockDb.expense.delete).not.toHaveBeenCalled();
  });

  it("deletes the expense by id once access is confirmed", async () => {
    mockDb.expense.delete.mockResolvedValue({ id: "expense-1" } as any);

    const res = await DELETE(makeDeleteRequest(), { params: { expenseId: "expense-1" } });

    expect(res.status).toBe(200);
    expect(mockDb.expense.delete).toHaveBeenCalledWith({ where: { id: "expense-1" } });
  });
});
