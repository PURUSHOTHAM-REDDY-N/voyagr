import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId, handleApiError, ApiError } from "@/lib/api-utils";
import { getPlanAdmin } from "@/lib/server/plan";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { accessId: string } }
) {
  try {
    const userId = await requireUserId();

    const access = await db.access.findUnique({ where: { id: params.accessId } });
    if (!access) {
      throw new ApiError("Access record not found", 404);
    }

    // This is only ever surfaced to plan admins in the UI (AccessRecords.tsx,
    // rendered on the collaborate page) - without this check any signed-in
    // user who obtained an accessId could revoke someone else's access to a
    // plan they have no relation to.
    const admin = await getPlanAdmin(access.planId, userId);
    if (!admin.isPlanAdmin) {
      throw new ApiError("Only the plan admin can revoke access", 403);
    }

    console.log(`User ${userId} revoked access for ${params.accessId}`);
    await db.access.delete({ where: { id: params.accessId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
