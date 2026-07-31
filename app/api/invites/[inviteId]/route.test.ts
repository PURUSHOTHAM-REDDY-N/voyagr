import { NextRequest } from "next/server";

jest.mock("@/auth");
jest.mock("@/lib/db");

import { auth } from "@/auth";
import { mockDb } from "@/lib/testUtils/mockDb";
import { DELETE } from "./route";

const mockAuth = auth as jest.Mock;

function makeRequest() {
  return new NextRequest("http://localhost/api/invites/invite-1", { method: "DELETE" });
}

const invite = { id: "invite-1", planId: "plan-1", email: "invitee@example.com", token: "tok" } as any;

describe("DELETE /api/invites/[inviteId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when not signed in", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await DELETE(makeRequest(), { params: { inviteId: "invite-1" } });
    expect(res.status).toBe(401);
  });

  it("returns 404 when the invite doesn't exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: "owner-1" } });
    mockDb.invite.findUnique.mockResolvedValue(null);

    const res = await DELETE(makeRequest(), { params: { inviteId: "missing" } });
    expect(res.status).toBe(404);
  });

  it("rejects a caller who isn't the plan's admin (IDOR guard)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "random-other-user" } });
    mockDb.invite.findUnique.mockResolvedValue(invite);
    mockDb.plan.findUnique.mockResolvedValue({ id: "plan-1", userId: "owner-1" } as any);

    const res = await DELETE(makeRequest(), { params: { inviteId: "invite-1" } });
    expect(res.status).toBe(403);
    expect(mockDb.invite.delete).not.toHaveBeenCalled();
  });

  it("lets the plan admin revoke a pending invite", async () => {
    mockAuth.mockResolvedValue({ user: { id: "owner-1" } });
    mockDb.invite.findUnique.mockResolvedValue(invite);
    mockDb.plan.findUnique.mockResolvedValue({ id: "plan-1", userId: "owner-1" } as any);
    mockDb.invite.delete.mockResolvedValue(invite);

    const res = await DELETE(makeRequest(), { params: { inviteId: "invite-1" } });

    expect(res.status).toBe(200);
    expect(mockDb.invite.delete).toHaveBeenCalledWith({ where: { id: "invite-1" } });
  });
});
