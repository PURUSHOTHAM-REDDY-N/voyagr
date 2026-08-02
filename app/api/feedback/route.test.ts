import { NextRequest } from "next/server";

jest.mock("@/auth");
jest.mock("@/lib/db");

import { auth } from "@/auth";
import { mockDb } from "@/lib/testUtils/mockDb";
import { POST } from "./route";

const mockAuth = auth as jest.Mock;

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/feedback", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/feedback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when not signed in", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ message: "Great app!", label: "idea" }));
    expect(res.status).toBe(401);
    expect(mockDb.feedback.create).not.toHaveBeenCalled();
  });

  it("records feedback tied to the signed-in user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDb.feedback.create.mockResolvedValue({} as any);

    const res = await POST(makeRequest({ planId: "plan-1", message: "Great app!", label: "idea" }));

    expect(res.status).toBe(200);
    expect(mockDb.feedback.create).toHaveBeenCalledWith({
      data: { userId: "user-1", planId: "plan-1", message: "Great app!", label: "idea" },
    });
  });

  it("allows feedback with no planId (general, not tied to a specific plan)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDb.feedback.create.mockResolvedValue({} as any);

    const res = await POST(makeRequest({ message: "General feedback", label: "question" }));

    expect(res.status).toBe(200);
    expect(mockDb.feedback.create).toHaveBeenCalledWith({
      data: { userId: "user-1", planId: undefined, message: "General feedback", label: "question" },
    });
  });
});
