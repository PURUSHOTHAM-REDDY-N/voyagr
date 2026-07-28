import { NextRequest } from "next/server";

jest.mock("@/auth");

import { auth } from "@/auth";
import { POST } from "./route";

const mockAuth = auth as jest.Mock;

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/recommendations", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const poi = (overrides: Record<string, unknown> = {}) => ({
  name: "Test POI",
  category: "museum",
  weatherAlign: "indoor",
  openTime: "09:00",
  closeTime: "17:00",
  cost: 20,
  coordinates: { lat: 0, lng: 0 },
  ...overrides,
});

describe("POST /api/recommendations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when not signed in", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ candidates: [] }));
    expect(res.status).toBe(401);
  });

  it("rejects a body without a candidates array", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const res = await POST(makeRequest({ candidates: "not-an-array" }));
    expect(res.status).toBe(400);
  });

  it("filters and ranks candidates, and reports a latency figure", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const res = await POST(
      makeRequest({
        candidates: [poi({ name: "Rainy Park", weatherAlign: "outdoor" }), poi({ name: "Good Museum" })],
        weatherState: "Rain",
        currentTime: "2026-01-01T10:00:00.000Z",
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.map((r: any) => r.name)).toEqual(["Good Museum"]);
    expect(typeof body.latencyMs).toBe("number");
  });
});
