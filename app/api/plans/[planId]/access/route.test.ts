import { NextRequest } from "next/server";

jest.mock("@/auth");
jest.mock("@/lib/db");

import { auth } from "@/auth";
import { mockDb } from "@/lib/testUtils/mockDb";
import { GET } from "./route";

const mockAuth = auth as jest.Mock;

function makeRequest() {
  return new NextRequest("http://localhost/api/plans/plan-1/access");
}

describe("GET /api/plans/[planId]/access", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when not signed in", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeRequest(), { params: { planId: "plan-1" } });
    expect(res.status).toBe(401);
  });

  it("returns an empty list for a non-admin rather than the real records", async () => {
    mockAuth.mockResolvedValue({ user: { id: "collaborator-1" } });
    mockDb.plan.findUnique.mockResolvedValue({ id: "plan-1", userId: "owner-1" } as any);

    const res = await GET(makeRequest(), { params: { planId: "plan-1" } });
    const body = await res.json();

    expect(body).toEqual([]);
    expect(mockDb.access.findMany).not.toHaveBeenCalled();
  });

  it("returns access records with resolved display names for the plan admin", async () => {
    mockAuth.mockResolvedValue({ user: { id: "owner-1" } });
    mockDb.plan.findUnique.mockResolvedValue({ id: "plan-1", userId: "owner-1" } as any);
    mockDb.access.findMany.mockResolvedValue([
      { id: "a1", planId: "plan-1", userId: "collaborator-1", email: "c1@example.com" },
    ] as any);
    mockDb.user.findUnique.mockResolvedValue({ firstName: "Ada", lastName: "Lovelace" } as any);

    const res = await GET(makeRequest(), { params: { planId: "plan-1" } });
    const body = await res.json();

    expect(body).toEqual([
      { id: "a1", planId: "plan-1", userId: "collaborator-1", email: "c1@example.com", firstName: "Ada", lastName: "Lovelace" },
    ]);
  });
});
