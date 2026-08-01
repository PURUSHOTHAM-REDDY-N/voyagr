import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId, handleApiError } from "@/lib/api-utils";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const userId = await requireUserId();
    const { planId } = params;
    const { fromDate, toDate } = await req.json();
    console.log(`updateTravelDates called by ${userId} on planId : ${planId}`);

    await db.planSettings.upsert({
      where: { planId },
      update: { fromDate: new Date(fromDate), toDate: new Date(toDate) },
      create: {
        planId,
        userId,
        fromDate: new Date(fromDate),
        toDate: new Date(toDate),
        isPublished: false,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
