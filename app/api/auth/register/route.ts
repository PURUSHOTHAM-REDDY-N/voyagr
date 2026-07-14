import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ApiError, handleApiError } from "@/lib/api-utils";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(req: NextRequest) {
  try {
    const { email, password, firstName, lastName } = await req.json();

    if (typeof email !== "string" || !email.includes("@")) {
      throw new ApiError("A valid email is required", 400);
    }
    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
      throw new ApiError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`, 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      throw new ApiError("An account with this email already exists", 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await db.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName: typeof firstName === "string" ? firstName : undefined,
        lastName: typeof lastName === "string" ? lastName : undefined,
      },
    });

    console.log(`registered new user ${user.id} (${user.email})`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
