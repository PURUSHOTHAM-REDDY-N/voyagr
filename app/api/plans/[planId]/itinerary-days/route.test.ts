import { NextRequest } from "next/server";

jest.mock("@/auth");
jest.mock("@/lib/db");

import { auth } from "@/auth";
import { mockDb } from "@/lib/testUtils/mockDb";
import { POST } from "./route";

const mockAuth = auth as jest.Mock;

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/plans/plan-1/itinerary-days", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const emptyActivities = { morning: [], afternoon: [], evening: [] };

describe("POST /api/plans/[planId]/itinerary-days", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "owner-1" } });
  });

  it("returns 401 when not signed in", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ itineraryDay: { title: "x", activities: emptyActivities } }), {
      params: { planId: "plan-1" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller has no access to the plan", async () => {
    mockAuth.mockResolvedValue({ user: { id: "stranger" } });
    mockDb.plan.findUnique.mockResolvedValue({ id: "plan-1", userId: "owner-1", itinerary: [] } as any);
    mockDb.access.findFirst.mockResolvedValue(null);

    const res = await POST(makeRequest({ itineraryDay: { title: "x", activities: emptyActivities } }), {
      params: { planId: "plan-1" },
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 when the plan doesn't exist", async () => {
    mockDb.plan.findUnique.mockResolvedValue(null);
    const res = await POST(makeRequest({ itineraryDay: { title: "x", activities: emptyActivities } }), {
      params: { planId: "missing" },
    });
    expect(res.status).toBe(404);
  });

  it("numbers the new day one past the current length", async () => {
    mockDb.plan.findUnique.mockResolvedValue({
      id: "plan-1",
      userId: "owner-1",
      itinerary: [{ title: "Day 1", activities: emptyActivities }, { title: "Day 2", activities: emptyActivities }],
    } as any);

    await POST(
      makeRequest({ itineraryDay: { activities: { morning: [{ itineraryItem: "Museum", briefDescription: "" }], afternoon: [], evening: [] } } }),
      { params: { planId: "plan-1" } }
    );

    const call = mockDb.plan.update.mock.calls[0][0] as any;
    expect(call.data.itinerary).toHaveLength(3);
    expect(call.data.itinerary[2].title).toBe("Day 3");
  });

  it("appends to the existing itinerary rather than replacing it", async () => {
    mockDb.plan.findUnique.mockResolvedValue({
      id: "plan-1",
      userId: "owner-1",
      itinerary: [{ title: "Day 1", activities: { morning: [{ itineraryItem: "Existing" }], afternoon: [], evening: [] } }],
    } as any);

    await POST(makeRequest({ itineraryDay: { activities: emptyActivities } }), { params: { planId: "plan-1" } });

    const call = mockDb.plan.update.mock.calls[0][0] as any;
    expect(call.data.itinerary[0].activities.morning[0].itineraryItem).toBe("Existing");
  });
});
