import { NextRequest, NextResponse } from "next/server";
import { requireUserId, handleApiError } from "@/lib/api-utils";
import { getPlanAdmin } from "@/lib/server/plan";

export async function GET(
  _req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const userId = await requireUserId();
    const result = await getPlanAdmin(params.planId, userId);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
