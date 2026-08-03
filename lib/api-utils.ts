import { auth } from "@/auth";
import { NextResponse } from "next/server";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Mirrors convex/utils.ts's getIdentityOrThrow - throws if the caller isn't signed in. */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new ApiError("Unauthorized access", 401);
  }
  return userId;
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json(
    { message: error instanceof Error ? error.message : "Internal Server Error" },
    { status: 500 }
  );
}
