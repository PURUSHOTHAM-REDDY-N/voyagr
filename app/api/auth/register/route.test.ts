import { NextRequest } from "next/server";

// lib/api-utils.ts unconditionally imports @/auth (next-auth, ESM-only) at
// module load time - every route test needs this mocked even if the route
// itself never calls requireUserId, or Jest fails to parse the import chain.
jest.mock("@/auth");
jest.mock("@/lib/db");

import { mockDb } from "@/lib/testUtils/mockDb";
import { POST } from "./route";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const existingUser = {
  id: "1",
  email: "existing@example.com",
  passwordHash: "hashed",
  firstName: null,
  lastName: null,
  createdAt: new Date(),
};

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects a missing/invalid email", async () => {
    const res = await POST(makeRequest({ email: "not-an-email", password: "password123" }));
    expect(res.status).toBe(400);
    expect(mockDb.user.create).not.toHaveBeenCalled();
  });

  it("rejects a password under 8 characters", async () => {
    const res = await POST(makeRequest({ email: "new@example.com", password: "short" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/8 characters/);
    expect(mockDb.user.create).not.toHaveBeenCalled();
  });

  it("rejects a duplicate email with 409", async () => {
    mockDb.user.findUnique.mockResolvedValue(existingUser);

    const res = await POST(makeRequest({ email: "existing@example.com", password: "password123" }));
    expect(res.status).toBe(409);
    expect(mockDb.user.create).not.toHaveBeenCalled();
  });

  it("normalizes the email to lowercase before checking/creating", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    mockDb.user.create.mockResolvedValue({ ...existingUser, email: "new@example.com" });

    await POST(makeRequest({ email: "  New@Example.com  ", password: "password123" }));

    expect(mockDb.user.findUnique).toHaveBeenCalledWith({ where: { email: "new@example.com" } });
    expect(mockDb.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: "new@example.com" }) })
    );
  });

  it("hashes the password rather than storing it in plaintext", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    mockDb.user.create.mockResolvedValue(existingUser);

    await POST(makeRequest({ email: "new@example.com", password: "password123" }));

    const createCall = mockDb.user.create.mock.calls[0][0];
    expect(createCall.data.passwordHash).not.toBe("password123");
    expect(createCall.data).not.toHaveProperty("password");
  });

  it("creates a user and returns 200 on valid input", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    mockDb.user.create.mockResolvedValue(existingUser);

    const res = await POST(
      makeRequest({ email: "new@example.com", password: "password123", firstName: "Ada" })
    );
    expect(res.status).toBe(200);
  });
});
