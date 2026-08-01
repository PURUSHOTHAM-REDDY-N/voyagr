import { NextRequest } from "next/server";

jest.mock("@/auth");
jest.mock("@/lib/db");

import { auth } from "@/auth";
import { mockDb } from "@/lib/testUtils/mockDb";
import { POST } from "./route";

const mockAuth = auth as jest.Mock;

function makeRequest(ids: string[]) {
  return new NextRequest("http://localhost/api/expenses/bulk-delete", { method: "POST", body: JSON.stringify({ ids }) });
}

describe("POST /api/expenses/bulk-delete", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "caller-1" } });
  });

  it("returns 401 when not signed in", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest(["e1"]));
    expect(res.status).toBe(401);
  });

  it("deletes when the caller has access to every plan the expenses belong to", async () => {
    mockDb.expense.findMany.mockResolvedValue([
      { id: "e1", planId: "plan-1" },
      { id: "e2", planId: "plan-1" },
    ] as any);
    mockDb.plan.findUnique.mockResolvedValue({ id: "plan-1", userId: "caller-1" } as any);
    mockDb.expense.deleteMany.mockResolvedValue({ count: 2 } as any);

    const res = await POST(makeRequest(["e1", "e2"]));

    expect(res.status).toBe(200);
    expect(mockDb.expense.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["e1", "e2"] } } });
  });

  it("rejects the whole batch if the caller lacks access to any one of the plans involved", async () => {
    // regression test: this route used to have no access check at all -
    // any signed-in user could delete any expense on any plan just by ID.
    mockDb.expense.findMany.mockResolvedValue([
      { id: "e1", planId: "plan-1" }, // caller has access
      { id: "e2", planId: "plan-2" }, // caller does not
    ] as any);
    // planIds are deduped and looked up in order, so plan-1 (accessible)
    // resolves first and plan-2 (not accessible) second.
    mockDb.plan.findUnique
      .mockResolvedValueOnce({ id: "plan-1", userId: "caller-1" } as any)
      .mockResolvedValueOnce({ id: "plan-2", userId: "owner-2" } as any);
    mockDb.access.findFirst.mockResolvedValue(null);

    const res = await POST(makeRequest(["e1", "e2"]));

    expect(res.status).toBe(403);
    expect(mockDb.expense.deleteMany).not.toHaveBeenCalled();
  });
});
