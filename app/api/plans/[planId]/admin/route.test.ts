import { NextRequest } from "next/server";

jest.mock("@/auth");
jest.mock("@/lib/db");

import { auth } from "@/auth";
import { mockDb } from "@/lib/testUtils/mockDb";
import { GET } from "./route";

const mockAuth = auth as jest.Mock;

function makeRequest() {
  return new NextRequest("http://localhost/api/plans/plan-1/admin");
}

describe("GET /api/plans/[planId]/admin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when not signed in", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeRequest(), { params: { planId: "plan-1" } });
    expect(res.status).toBe(401);
  });

  it("reports isPlanAdmin true and the plan name for the owner", async () => {
    mockAuth.mockResolvedValue({ user: { id: "owner-1" } });
    mockDb.plan.findUnique.mockResolvedValue({ id: "plan-1", userId: "owner-1", nameoftheplace: "Tokyo" } as any);

    const res = await GET(makeRequest(), { params: { planId: "plan-1" } });
    const body = await res.json();

    expect(body).toEqual({ isPlanAdmin: true, planName: "Tokyo" });
  });

  it("reports isPlanAdmin false for a non-owner, even a collaborator with plan access", async () => {
    mockAuth.mockResolvedValue({ user: { id: "collaborator-1" } });
    mockDb.plan.findUnique.mockResolvedValue({ id: "plan-1", userId: "owner-1", nameoftheplace: "Tokyo" } as any);

    const res = await GET(makeRequest(), { params: { planId: "plan-1" } });
    const body = await res.json();

    expect(body).toEqual({ isPlanAdmin: false, planName: "" });
  });

  it("reports isPlanAdmin false (not a 404) when the plan doesn't exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDb.plan.findUnique.mockResolvedValue(null);

    const res = await GET(makeRequest(), { params: { planId: "missing" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ isPlanAdmin: false, planName: "" });
  });
});
