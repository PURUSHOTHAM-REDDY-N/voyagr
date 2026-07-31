import { NextRequest } from "next/server";

jest.mock("@/auth");
jest.mock("@/lib/db");
// Real SMTP is out of scope here - lib/server/rate-limit.ts and
// lib/server/token.ts are left real (pure/db-mock-backed logic worth
// exercising for real), only the actual email transport is mocked.
jest.mock("@/lib/server/mailer");
// @react-email/render internally uses a dynamic import() that Jest's
// default (non-ESM) test environment can't execute without the Node
// --experimental-vm-modules flag - mock it rather than change global Jest
// config just for this one route's email templating.
jest.mock("@react-email/render", () => ({ render: jest.fn().mockResolvedValue("<html>invite</html>") }));

import { auth } from "@/auth";
import { mockDb } from "@/lib/testUtils/mockDb";
import { sendMail } from "@/lib/server/mailer";
import { GET, POST } from "./route";

const mockAuth = auth as jest.Mock;
const mockSendMail = sendMail as jest.Mock;

function makeGetRequest() {
  return new NextRequest("http://localhost/api/plans/plan-1/invites");
}
function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/plans/plan-1/invites", { method: "POST", body: JSON.stringify(body) });
}

const plan = { id: "plan-1", userId: "owner-1", nameoftheplace: "Tokyo" };

describe("GET /api/plans/[planId]/invites", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when not signed in", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeGetRequest(), { params: { planId: "plan-1" } });
    expect(res.status).toBe(401);
  });

  it("returns an empty list for a non-admin", async () => {
    mockAuth.mockResolvedValue({ user: { id: "collaborator-1" } });
    mockDb.plan.findUnique.mockResolvedValue(plan as any);

    const res = await GET(makeGetRequest(), { params: { planId: "plan-1" } });
    const body = await res.json();
    expect(body).toEqual([]);
    expect(mockDb.invite.findMany).not.toHaveBeenCalled();
  });

  it("returns pending invites with resolved display names for the admin", async () => {
    mockAuth.mockResolvedValue({ user: { id: "owner-1" } });
    mockDb.plan.findUnique.mockResolvedValue(plan as any);
    mockDb.invite.findMany.mockResolvedValue([
      { id: "i1", planId: "plan-1", email: "a@example.com", token: "t1" },
    ] as any);
    mockDb.user.findUnique.mockResolvedValue({ firstName: "Ada", lastName: null } as any);

    const res = await GET(makeGetRequest(), { params: { planId: "plan-1" } });
    const body = await res.json();

    expect(body[0].firstName).toBe("Ada");
  });
});

describe("POST /api/plans/[planId]/invites", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "owner-1" } });
    mockDb.plan.findUnique.mockResolvedValue(plan as any);
    mockDb.rateLimit.findUnique.mockResolvedValue(null);
    mockSendMail.mockResolvedValue(undefined);
  });

  it("returns 401 when not signed in", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makePostRequest({ email: "friend@example.com" }), { params: { planId: "plan-1" } });
    expect(res.status).toBe(401);
  });

  it("rejects a non-admin trying to invite others", async () => {
    mockAuth.mockResolvedValue({ user: { id: "collaborator-1" } });
    const res = await POST(makePostRequest({ email: "friend@example.com" }), { params: { planId: "plan-1" } });
    expect(res.status).toBe(403);
    expect(mockDb.invite.create).not.toHaveBeenCalled();
  });

  it("rejects a duplicate invite to the same email for the same plan", async () => {
    mockDb.invite.findFirst.mockResolvedValue({ id: "existing" } as any);

    const res = await POST(makePostRequest({ email: "friend@example.com" }), { params: { planId: "plan-1" } });
    expect(res.status).toBe(400);
    expect(mockDb.invite.create).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("creates the invite and sends the email on success", async () => {
    mockDb.invite.findFirst.mockResolvedValue(null);
    mockDb.invite.create.mockResolvedValue({ id: "invite-1", planId: "plan-1", email: "friend@example.com", token: "tok" } as any);

    const res = await POST(makePostRequest({ email: "friend@example.com" }), { params: { planId: "plan-1" } });

    expect(res.status).toBe(200);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "friend@example.com", subject: expect.stringContaining("invited") })
    );
  });

  it("rolls back the invite record if sending the email fails", async () => {
    mockDb.invite.findFirst.mockResolvedValue(null);
    mockDb.invite.create.mockResolvedValue({ id: "invite-1", planId: "plan-1", email: "friend@example.com", token: "tok" } as any);
    mockSendMail.mockRejectedValue(new Error("SMTP down"));

    const res = await POST(makePostRequest({ email: "friend@example.com" }), { params: { planId: "plan-1" } });

    expect(res.status).toBe(400);
    expect(mockDb.invite.delete).toHaveBeenCalledWith({ where: { id: "invite-1" } });
  });

  it("enforces the daily invite rate limit", async () => {
    // sendEmailInviteLimit allows 3 per 24h - simulate the 4th attempt in
    // the same window by having db.rateLimit already at the cap.
    mockDb.rateLimit.findUnique.mockResolvedValue({ key: "sendEmailInvite:owner-1", count: 3, windowStart: new Date() } as any);

    const res = await POST(makePostRequest({ email: "friend@example.com" }), { params: { planId: "plan-1" } });

    expect(res.status).toBe(429);
    expect(mockDb.invite.create).not.toHaveBeenCalled();
  });
});
