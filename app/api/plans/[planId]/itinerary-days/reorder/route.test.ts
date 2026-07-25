import { NextRequest } from "next/server";

jest.mock("@/auth");
jest.mock("@/lib/db");

import { auth } from "@/auth";
import { mockDb } from "@/lib/testUtils/mockDb";
import { PATCH } from "./route";

const mockAuth = auth as jest.Mock;

const emptyActivities = { morning: [], afternoon: [], evening: [] };

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/plans/plan-1/itinerary-days/reorder", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/plans/[planId]/itinerary-days/reorder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "owner-1" } });
    mockDb.plan.findUnique.mockResolvedValue({
      id: "plan-1",
      userId: "owner-1",
      itinerary: [
        { title: "Day 1: Louvre", activities: emptyActivities },
        { title: "Day 2: Eiffel Tower", activities: emptyActivities },
      ],
    } as any);
  });

  it("returns 401 when not signed in", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ fromIndex: 0, toIndex: 1 }), { params: { planId: "plan-1" } });
    expect(res.status).toBe(401);
  });

  it("rejects non-numeric indices with 400", async () => {
    const res = await PATCH(makeRequest({ fromIndex: "0", toIndex: 1 }), { params: { planId: "plan-1" } });
    expect(res.status).toBe(400);
    expect(mockDb.plan.update).not.toHaveBeenCalled();
  });

  it("moves day content, not just the title numbering", async () => {
    await PATCH(makeRequest({ fromIndex: 1, toIndex: 0 }), { params: { planId: "plan-1" } });

    const call = mockDb.plan.update.mock.calls[0][0] as any;
    expect(call.data.itinerary.map((d: any) => d.title)).toEqual(["Day 1: Eiffel Tower", "Day 2: Louvre"]);
  });

  it("returns 400 (not 500) for an out-of-range index", async () => {
    const res = await PATCH(makeRequest({ fromIndex: 0, toIndex: 5 }), { params: { planId: "plan-1" } });
    expect(res.status).toBe(400);
    expect(mockDb.plan.update).not.toHaveBeenCalled();
  });
});
