import { NextRequest } from "next/server";

jest.mock("@/auth");
jest.mock("@/lib/db");

import { auth } from "@/auth";
import { mockDb } from "@/lib/testUtils/mockDb";
import { GET, PATCH } from "./route";

const mockAuth = auth as jest.Mock;

const safeUser = {
  id: "user-1",
  email: "a@example.com",
  firstName: "Ada",
  lastName: null,
  createdAt: new Date(),
};

function makePatchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/users/me", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("/api/users/me", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET", () => {
    it("returns 401 when not signed in", async () => {
      mockAuth.mockResolvedValue(null);
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("queries Prisma with a select that excludes passwordHash", async () => {
      // A mock can't prove Prisma itself honors `select` at runtime - that's
      // Prisma's own contract, not this route's. What this route IS
      // responsible for is asking with the right select in the first place;
      // that's what a query-shape regression (e.g. someone deleting the
      // select line, or spreading the row) would actually look like.
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      mockDb.user.findUnique.mockResolvedValue(safeUser as any);

      await GET();

      const call = mockDb.user.findUnique.mock.calls[0][0] as { select?: Record<string, unknown> };
      expect(call.select).toBeDefined();
      expect(Object.keys(call.select!)).not.toContain("passwordHash");
    });

    it("returns exactly what Prisma resolves, without adding extra fields", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      mockDb.user.findUnique.mockResolvedValue(safeUser as any);

      const res = await GET();
      const body = await res.json();
      expect(body).toEqual(JSON.parse(JSON.stringify(safeUser)));
    });
  });

  describe("PATCH", () => {
    it("returns 401 when not signed in", async () => {
      mockAuth.mockResolvedValue(null);
      const res = await PATCH(makePatchRequest({ firstName: "Ada" }));
      expect(res.status).toBe(401);
    });

    it("rejects a missing firstName", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      const res = await PATCH(makePatchRequest({ lastName: "Lovelace" }));
      expect(res.status).toBe(400);
      expect(mockDb.user.update).not.toHaveBeenCalled();
    });

    it("updates the display name using the same passwordHash-excluding select", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      mockDb.user.update.mockResolvedValue({ ...safeUser, lastName: "Lovelace" } as any);

      const res = await PATCH(makePatchRequest({ firstName: "Ada", lastName: "Lovelace" }));

      expect(res.status).toBe(200);
      const call = mockDb.user.update.mock.calls[0][0] as {
        where: unknown;
        data: unknown;
        select?: Record<string, unknown>;
      };
      expect(call.where).toEqual({ id: "user-1" });
      expect(call.data).toEqual({ firstName: "Ada", lastName: "Lovelace" });
      expect(Object.keys(call.select!)).not.toContain("passwordHash");
    });
  });
});
