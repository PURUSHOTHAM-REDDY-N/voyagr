import type { PrismaClient } from "@prisma/client";
import type { DeepMockProxy } from "jest-mock-extended";
import { db } from "@/lib/db";

/**
 * Typed handle onto the mocked `db` singleton. Callers must `jest.mock("@/lib/db")`
 * (which picks up lib/__mocks__/db.ts) before importing this - the runtime object
 * is the same `db`, this just restores the DeepMockProxy type Jest's module
 * mocking erases from the static import.
 */
export const mockDb = db as unknown as DeepMockProxy<PrismaClient>;
