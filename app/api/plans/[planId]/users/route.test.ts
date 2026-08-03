import { NextRequest } from "next/server";

jest.mock("@/auth");
jest.mock("@/lib/db");

import { auth } from "@/auth";
import { mockDb } from "@/lib/testUtils/mockDb";
import { GET } from "./route";

const mockAuth = auth as jest.Mock;

function makeRequest() {
  return new NextRequest("http://localhost/api/plans/plan-1/users");
}

const plan = { id: "plan-1", userId: "owner-1", nameoftheplace: "Paris" } as any;

describe("GET /api/plans/[planId]/users", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when not signed in", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeRequest(), { params: { planId: "plan-1" } });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a caller with no access to the plan", async () => {
    mockAuth.mockResolvedValue({ user: { id: "stranger" } });
    mockDb.plan.findUnique.mockResolvedValue(plan);
    mockDb.access.findFirst.mockResolvedValue(null);

    const res = await GET(makeRequest(), { params: { planId: "plan-1" } });
    expect(res.status).toBe(403);
  });

  it("returns every collaborator, not just the caller (regression test for the convex-ported bug)", async () => {
    // Previously filtered Access by { planId, userId } (only the caller's
    // own row) instead of { planId } (every collaborator) - a bug ported
    // as-is from convex/plan.ts's getAllUsersForAPlan during the migration.
    // A 3-person plan (owner + 2 collaborators) must return all 3.
    mockAuth.mockResolvedValue({ user: { id: "collaborator-1" } });
    mockDb.plan.findUnique.mockResolvedValue(plan);
    mockDb.access.findFirst.mockResolvedValue({ id: "a1", planId: "plan-1", userId: "collaborator-1" } as any);
    mockDb.access.findMany.mockResolvedValue([
      { id: "a1", planId: "plan-1", userId: "collaborator-1" },
      { id: "a2", planId: "plan-1", userId: "collaborator-2" },
    ] as any);
    mockDb.user.findMany.mockResolvedValue([
      { id: "owner-1", email: "owner@example.com", firstName: "Owner", lastName: null },
      { id: "collaborator-1", email: "c1@example.com", firstName: "C1", lastName: null },
      { id: "collaborator-2", email: "c2@example.com", firstName: "C2", lastName: null },
    ] as any);

    const res = await GET(makeRequest(), { params: { planId: "plan-1" } });
    const body = await res.json();

    expect(mockDb.access.findMany).toHaveBeenCalledWith({ where: { planId: "plan-1" } });
    expect(body).toHaveLength(3);
    expect(body.map((u: any) => u.id).sort()).toEqual(["collaborator-1", "collaborator-2", "owner-1"]);
  });

  it("flags exactly the caller as IsCurrentUser", async () => {
    mockAuth.mockResolvedValue({ user: { id: "collaborator-1" } });
    mockDb.plan.findUnique.mockResolvedValue(plan);
    mockDb.access.findFirst.mockResolvedValue({ id: "a1", planId: "plan-1", userId: "collaborator-1" } as any);
    mockDb.access.findMany.mockResolvedValue([{ id: "a1", planId: "plan-1", userId: "collaborator-1" }] as any);
    mockDb.user.findMany.mockResolvedValue([
      { id: "owner-1", email: "owner@example.com", firstName: "Owner", lastName: null },
      { id: "collaborator-1", email: "c1@example.com", firstName: "C1", lastName: null },
    ] as any);

    const res = await GET(makeRequest(), { params: { planId: "plan-1" } });
    const body = await res.json();

    const owner = body.find((u: any) => u.id === "owner-1");
    const caller = body.find((u: any) => u.id === "collaborator-1");
    expect(owner.IsCurrentUser).toBe(false);
    expect(caller.IsCurrentUser).toBe(true);
  });
});
