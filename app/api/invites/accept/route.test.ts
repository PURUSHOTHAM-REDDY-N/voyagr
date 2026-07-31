import { NextRequest } from "next/server";

jest.mock("@/auth");
jest.mock("@/lib/db");

import { auth } from "@/auth";
import { mockDb } from "@/lib/testUtils/mockDb";
import { POST } from "./route";

const mockAuth = auth as jest.Mock;

function makeRequest(token: string) {
  return new NextRequest("http://localhost/api/invites/accept", { method: "POST", body: JSON.stringify({ token }) });
}

const invite = { id: "invite-1", planId: "plan-1", email: "invitee@example.com", token: "tok-123" };
const invitedUser = { id: "invitee-1", email: "invitee@example.com", firstName: "Ada" };
const plan = { id: "plan-1", userId: "owner-1", nameoftheplace: "Tokyo" };

describe("POST /api/invites/accept", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "invitee-1" } });
  });

  it("returns 401 when not signed in", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest("tok-123"));
    expect(res.status).toBe(401);
  });

  it("returns 404 for an unknown token", async () => {
    mockDb.invite.findFirst.mockResolvedValue(null);
    const res = await POST(makeRequest("bogus"));
    expect(res.status).toBe(404);
  });

  it("returns 404 if the invited email has no matching user account", async () => {
    mockDb.invite.findFirst.mockResolvedValue(invite as any);
    mockDb.user.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest("tok-123"));
    expect(res.status).toBe(404);
  });

  it("returns 404 if the plan the invite was for no longer exists", async () => {
    mockDb.invite.findFirst.mockResolvedValue(invite as any);
    mockDb.user.findUnique.mockResolvedValue(invitedUser as any);
    mockDb.plan.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest("tok-123"));
    expect(res.status).toBe(404);
  });

  it("rejects the plan owner accepting their own invite", async () => {
    mockAuth.mockResolvedValue({ user: { id: "owner-1" } });
    mockDb.invite.findFirst.mockResolvedValue(invite as any);
    mockDb.user.findUnique.mockResolvedValue(invitedUser as any);
    mockDb.plan.findUnique.mockResolvedValue(plan as any);

    const res = await POST(makeRequest("tok-123"));
    expect(res.status).toBe(400);
    expect(mockDb.access.create).not.toHaveBeenCalled();
  });

  it("grants access and consumes the invite token on success", async () => {
    mockDb.invite.findFirst.mockResolvedValue(invite as any);
    mockDb.user.findUnique.mockResolvedValue(invitedUser as any);
    mockDb.plan.findUnique.mockResolvedValue(plan as any);
    mockDb.access.create.mockResolvedValue({} as any);
    mockDb.invite.delete.mockResolvedValue(invite as any);

    const res = await POST(makeRequest("tok-123"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ planId: "plan-1" });
    expect(mockDb.access.create).toHaveBeenCalledWith({
      data: { planId: "plan-1", userId: "invitee-1", email: "invitee@example.com" },
    });
    expect(mockDb.invite.delete).toHaveBeenCalledWith({ where: { id: "invite-1" } });
  });

  it("grants access using the invited email's account, not necessarily the signed-in caller's own", async () => {
    // The invite is keyed by email, and access is granted to whoever owns
    // that email address - not automatically the signed-in caller, in case
    // they're accepting on behalf of a different logged-in identity than
    // the one the invite was sent to.
    mockAuth.mockResolvedValue({ user: { id: "some-other-signed-in-id" } });
    mockDb.invite.findFirst.mockResolvedValue(invite as any);
    mockDb.user.findUnique.mockResolvedValue(invitedUser as any); // invitedUser.id = "invitee-1"
    mockDb.plan.findUnique.mockResolvedValue(plan as any);
    mockDb.access.create.mockResolvedValue({} as any);

    await POST(makeRequest("tok-123"));

    expect(mockDb.access.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "invitee-1" }) })
    );
  });
});
