import { NextRequest } from "next/server";

jest.mock("@/auth");
jest.mock("@/lib/db");

import { auth } from "@/auth";
import { mockDb } from "@/lib/testUtils/mockDb";
import { DELETE } from "./route";

const mockAuth = auth as jest.Mock;

function makeRequest() {
  return new NextRequest("http://localhost/api/access/access-1", { method: "DELETE" });
}

const access = { id: "access-1", planId: "plan-1", userId: "collaborator-1", email: "c1@example.com" } as any;

describe("DELETE /api/access/[accessId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when not signed in", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await DELETE(makeRequest(), { params: { accessId: "access-1" } });
    expect(res.status).toBe(401);
    expect(mockDb.access.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when the access record doesn't exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: "owner-1" } });
    mockDb.access.findUnique.mockResolvedValue(null);

    const res = await DELETE(makeRequest(), { params: { accessId: "missing" } });
    expect(res.status).toBe(404);
    expect(mockDb.access.delete).not.toHaveBeenCalled();
  });

  it("rejects a caller who isn't the plan's admin (IDOR guard)", async () => {
    // Anyone signed in, not just the plan owner, previously could revoke
    // any collaborator's access to any plan just by knowing an accessId.
    mockAuth.mockResolvedValue({ user: { id: "random-other-user" } });
    mockDb.access.findUnique.mockResolvedValue(access);
    mockDb.plan.findUnique.mockResolvedValue({ id: "plan-1", userId: "owner-1" } as any);

    const res = await DELETE(makeRequest(), { params: { accessId: "access-1" } });
    expect(res.status).toBe(403);
    expect(mockDb.access.delete).not.toHaveBeenCalled();
  });

  it("lets the plan admin revoke a collaborator's access", async () => {
    mockAuth.mockResolvedValue({ user: { id: "owner-1" } });
    mockDb.access.findUnique.mockResolvedValue(access);
    mockDb.plan.findUnique.mockResolvedValue({ id: "plan-1", userId: "owner-1" } as any);
    mockDb.access.delete.mockResolvedValue(access);

    const res = await DELETE(makeRequest(), { params: { accessId: "access-1" } });

    expect(res.status).toBe(200);
    expect(mockDb.access.delete).toHaveBeenCalledWith({ where: { id: "access-1" } });
  });

  it("rejects even the collaborator whose own access it is (admin-only, not self-service)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "collaborator-1" } });
    mockDb.access.findUnique.mockResolvedValue(access);
    mockDb.plan.findUnique.mockResolvedValue({ id: "plan-1", userId: "owner-1" } as any);

    const res = await DELETE(makeRequest(), { params: { accessId: "access-1" } });
    expect(res.status).toBe(403);
  });
});
