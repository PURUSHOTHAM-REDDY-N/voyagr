import { NextRequest } from "next/server";

jest.mock("@/auth");
jest.mock("@/lib/db");

import { auth } from "@/auth";
import { mockDb } from "@/lib/testUtils/mockDb";
import { DELETE } from "./route";

const mockAuth = auth as jest.Mock;

const emptyActivities = { morning: [], afternoon: [], evening: [] };

function makeRequest() {
  return new NextRequest("http://localhost/api/plans/plan-1/itinerary-days/Day%201", { method: "DELETE" });
}

describe("DELETE /api/plans/[planId]/itinerary-days/[dayName]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "owner-1" } });
  });

  it("returns 401 when not signed in", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await DELETE(makeRequest(), { params: { planId: "plan-1", dayName: "Day 1" } });
    expect(res.status).toBe(401);
  });

  it("removes exactly the matching day and renumbers the rest", async () => {
    mockDb.plan.findUnique.mockResolvedValue({
      id: "plan-1",
      userId: "owner-1",
      itinerary: [
        { title: "Day 1", activities: emptyActivities },
        { title: "Day 2", activities: emptyActivities },
        { title: "Day 3", activities: emptyActivities },
      ],
    } as any);

    await DELETE(makeRequest(), { params: { planId: "plan-1", dayName: "Day 2" } });

    const call = mockDb.plan.update.mock.calls[0][0] as any;
    expect(call.data.itinerary.map((d: any) => d.title)).toEqual(["Day 1", "Day 2"]);
  });

  it("matches the day name exactly, not as a substring (regression test for the old .includes() bug)", async () => {
    // "Day 1" used to match via .includes(), which would also match "Day 10"
    // or "Day 1: Explore the Old Town" - exact equality is required so
    // deleting "Day 1" never accidentally deletes a differently-titled day.
    mockDb.plan.findUnique.mockResolvedValue({
      id: "plan-1",
      userId: "owner-1",
      itinerary: [
        { title: "Day 1", activities: emptyActivities },
        { title: "Day 1: Explore the Old Town", activities: emptyActivities },
      ],
    } as any);

    await DELETE(makeRequest(), { params: { planId: "plan-1", dayName: "Day 1" } });

    const call = mockDb.plan.update.mock.calls[0][0] as any;
    // Only the exact "Day 1" match is removed; "Day 1: Explore the Old Town"
    // survives (renumbered to slot 1, suffix preserved) rather than also
    // being deleted by a loose substring match.
    expect(call.data.itinerary).toHaveLength(1);
    expect(call.data.itinerary[0].title).toBe("Day 1: Explore the Old Town");
  });

  it("returns 404 when the plan doesn't exist", async () => {
    mockDb.plan.findUnique.mockResolvedValue(null);
    const res = await DELETE(makeRequest(), { params: { planId: "missing", dayName: "Day 1" } });
    expect(res.status).toBe(404);
  });
});
