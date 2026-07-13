import { mockDeep } from "jest-mock-extended";
import type { PrismaClient } from "@prisma/client";

// Manual mock: picked up automatically whenever a test calls jest.mock("@/lib/db").
export const db = mockDeep<PrismaClient>();
