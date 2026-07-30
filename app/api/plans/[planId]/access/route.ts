import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-utils";
import { getPlanAdmin } from "@/lib/server/plan";
import { requireUserId } from "@/lib/api-utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const userId = await requireUserId();
    const { planId } = params;

    const admin = await getPlanAdmin(planId, userId);
    if (!admin.isPlanAdmin) return NextResponse.json([]);

    const accesses = await db.access.findMany({ where: { planId } });

    const result = await Promise.all(
      accesses.map(async (access) => {
        const currentUser = await db.user.findUnique({ where: { email: access.email } });
        return {
          ...access,
          firstName: currentUser?.firstName,
          lastName: currentUser?.lastName,
        };
      })
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
