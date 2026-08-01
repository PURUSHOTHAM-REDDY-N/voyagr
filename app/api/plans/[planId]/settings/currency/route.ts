import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId, handleApiError } from "@/lib/api-utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const userId = await requireUserId();
    const { planId } = params;
    console.log(`getPreferredCurrency called by ${userId} on planId : ${planId}`);
    const planSetting = await db.planSettings.findUnique({ where: { planId } });
    return NextResponse.json(planSetting?.currencyCode ?? null);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const userId = await requireUserId();
    const { planId } = params;
    const { currencyCode } = await req.json();
    console.log(`addPreferredCurrency called by ${userId} on planId : ${planId}`);

    await db.planSettings.upsert({
      where: { planId },
      update: { currencyCode },
      create: { planId, userId, currencyCode, isPublished: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
