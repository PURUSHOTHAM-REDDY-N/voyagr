import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId, handleApiError } from "@/lib/api-utils";

// passwordHash must never leave the server - explicit select on every query
// in this route rather than trusting call sites to strip it after the fact.
const PUBLIC_USER_FIELDS = { id: true, email: true, firstName: true, lastName: true, createdAt: true } as const;

export async function GET() {
  try {
    const userId = await requireUserId();
    const user = await db.user.findUnique({ where: { id: userId }, select: PUBLIC_USER_FIELDS });
    return NextResponse.json(user);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const { firstName, lastName } = await req.json();
    if (!firstName) {
      return NextResponse.json({ message: "First Name is mandatory!" }, { status: 400 });
    }

    console.log({ firstName, lastName });
    const user = await db.user.update({
      where: { id: userId },
      data: { firstName, lastName },
      select: PUBLIC_USER_FIELDS,
    });
    return NextResponse.json(user);
  } catch (error) {
    return handleApiError(error);
  }
}
