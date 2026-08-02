import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId, handleApiError } from "@/lib/api-utils";
import { getSharedPlans } from "@/lib/server/plan";

export async function GET() {
  try {
    const userId = await requireUserId();
    const ownPlans = await db.plan.findMany({ where: { userId } });
    const sharedPlans = await getSharedPlans(userId);
    return NextResponse.json(ownPlans.concat(sharedPlans));
  } catch (error) {
    return handleApiError(error);
  }
}
