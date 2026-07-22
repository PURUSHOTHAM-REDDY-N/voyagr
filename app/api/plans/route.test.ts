import { NextRequest } from "next/server";

jest.mock("@/auth");
jest.mock("@/lib/db");

import { auth } from "@/auth";
import { mockDb } from "@/lib/testUtils/mockDb";
import { GET, POST } from "./route";

const mockAuth = auth as jest.Mock;

function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/plans", { method: "POST", body: JSON.stringify(body) });
}

const ownPlan = { id: "own-1", userId: "user-1", nameoftheplace: "Tokyo" } as any;
const sharedPlan = { id: "shared-1", userId: "owner-2", nameoftheplace: "Rome" } as any;

describe("GET /api/plans", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDb.planSettings.findUnique.mockResolvedValue(null);
  });

  it("returns 401 when not signed in", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("combines a user's own plans with plans shared with them via Access records", async () => {
    mockDb.plan.findMany.mockResolvedValueOnce([ownPlan]); // db.plan.findMany({ where: { userId } })
    mockDb.access.findMany.mockResolvedValue([{ id: "a1", planId: "shared-1", userId: "user-1" }] as any);
    mockDb.plan.findMany.mockResolvedValueOnce([sharedPlan]); // inside getSharedPlans

    const res = await GET();
    const body = await res.json();

    expect(body).toHaveLength(2);
    expect(body.map((p: any) => p.id).sort()).toEqual(["own-1", "shared-1"]);
  });

  it("flags shared plans as isSharedPlan and owned plans as not", async () => {
    mockDb.plan.findMany.mockResolvedValueOnce([ownPlan]);
    mockDb.access.findMany.mockResolvedValue([{ id: "a1", planId: "shared-1", userId: "user-1" }] as any);
    mockDb.plan.findMany.mockResolvedValueOnce([sharedPlan]);

    const res = await GET();
    const body = await res.json();

    expect(body.find((p: any) => p.id === "own-1").isSharedPlan).toBe(false);
    expect(body.find((p: any) => p.id === "shared-1").isSharedPlan).toBe(true);
  });

  it("returns only owned plans when the user has no Access records (no wasted plan lookup)", async () => {
    mockDb.plan.findMany.mockResolvedValueOnce([ownPlan]);
    mockDb.access.findMany.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("own-1");
    // getSharedPlans short-circuits on an empty Access list rather than
    // querying db.plan.findMany a second time with an empty `in` filter.
    expect(mockDb.plan.findMany).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/plans", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("returns 401 when not signed in", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makePostRequest({ placeName: "Tokyo", noOfDays: "3" }));
    expect(res.status).toBe(401);
  });

  it("creates a plan and its settings, and returns the new planId", async () => {
    mockDb.plan.create.mockResolvedValue({ id: "new-plan", userId: "user-1" } as any);
    mockDb.planSettings.create.mockResolvedValue({} as any);

    const res = await POST(makePostRequest({ placeName: "Tokyo", noOfDays: "3", isGeneratedUsingAI: false }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.planId).toBe("new-plan");
    expect(mockDb.planSettings.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ planId: "new-plan", userId: "user-1" }) })
    );
  });

  it("marks every contentGenerationState flag true for a manually-created (non-AI) plan", async () => {
    mockDb.plan.create.mockResolvedValue({ id: "new-plan" } as any);
    mockDb.planSettings.create.mockResolvedValue({} as any);

    await POST(makePostRequest({ placeName: "Tokyo", noOfDays: "3", isGeneratedUsingAI: false }));

    const call = mockDb.plan.create.mock.calls[0][0] as any;
    expect(Object.values(call.data.contentGenerationState).every((v) => v === true)).toBe(true);
  });

  it("marks every contentGenerationState flag false for an AI-generated plan (still filling in)", async () => {
    mockDb.plan.create.mockResolvedValue({ id: "new-plan" } as any);
    mockDb.planSettings.create.mockResolvedValue({} as any);

    await POST(makePostRequest({ placeName: "Tokyo", noOfDays: "3", isGeneratedUsingAI: true }));

    const call = mockDb.plan.create.mock.calls[0][0] as any;
    expect(Object.values(call.data.contentGenerationState).every((v) => v === false)).toBe(true);
  });
});
