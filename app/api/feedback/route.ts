import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId, handleApiError } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const { planId, message, label } = await req.json();

    console.log(`${userId} added feedback`);
    await db.feedback.create({ data: { userId, planId, message, label } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
