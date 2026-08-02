import { NextRequest } from "next/server";

jest.mock("@/auth");
jest.mock("@/lib/db");

import { mockDb } from "@/lib/testUtils/mockDb";
import { GET } from "./route";

function makeRequest(query = "") {
  return new NextRequest(`http://localhost/api/community-plans${query}`);
}

const setting = (id: string) => ({ id, planId: `plan-${id}`, isPublished: true, createdAt: new Date() });
const plan = (id: string) => ({ id: `plan-${id}`, nameoftheplace: `Plan ${id}` });

describe("GET /api/community-plans", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("is publicly reachable without signing in (no auth check at all)", async () => {
    mockDb.planSettings.findMany.mockResolvedValue([]);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
  });

  it("provides a nextCursor only when the page came back full", async () => {
    mockDb.planSettings.findMany.mockResolvedValue([setting("1"), setting("2")] as any);
    mockDb.plan.findUnique.mockResolvedValueOnce(plan("1") as any).mockResolvedValueOnce(plan("2") as any);

    const res = await GET(makeRequest("?limit=2"));
    const body = await res.json();

    expect(body.items).toHaveLength(2);
    expect(body.nextCursor).toBe("2");
  });

  it("returns a null nextCursor on the last (partial) page", async () => {
    mockDb.planSettings.findMany.mockResolvedValue([setting("1")] as any);
    mockDb.plan.findUnique.mockResolvedValue(plan("1") as any);

    const res = await GET(makeRequest("?limit=9"));
    const body = await res.json();

    expect(body.nextCursor).toBeNull();
  });

  it("skips orphaned planSettings whose plan was deleted, rather than erroring", async () => {
    mockDb.planSettings.findMany.mockResolvedValue([setting("1"), setting("2")] as any);
    mockDb.plan.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(plan("2") as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe("plan-2");
  });

  it("filters by companion when provided", async () => {
    mockDb.planSettings.findMany.mockResolvedValue([]);

    await GET(makeRequest("?companion=Family"));

    expect(mockDb.planSettings.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isPublished: true, companion: "Family" }) })
    );
  });

  it("passes the cursor through to Prisma's cursor pagination", async () => {
    mockDb.planSettings.findMany.mockResolvedValue([]);

    await GET(makeRequest("?cursor=setting-5"));

    expect(mockDb.planSettings.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: "setting-5" }, skip: 1 })
    );
  });
});
