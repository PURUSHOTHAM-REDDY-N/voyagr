import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId, handleApiError, ApiError } from "@/lib/api-utils";
import { getPlanAdmin } from "@/lib/server/plan";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { inviteId: string } }
) {
  try {
    const userId = await requireUserId();

    const invite = await db.invite.findUnique({ where: { id: params.inviteId } });
    if (!invite) {
      throw new ApiError("Invite not found", 404);
    }

    // Same reasoning as /api/access/[accessId]: this is only ever surfaced
    // to plan admins in the UI (PendingInvites.tsx), so it needs its own
    // server-side check - without it, any signed-in user who obtained an
    // inviteId could delete an invite for a plan they have no relation to.
    const admin = await getPlanAdmin(invite.planId, userId);
    if (!admin.isPlanAdmin) {
      throw new ApiError("Only the plan admin can revoke an invite", 403);
    }

    await db.invite.delete({ where: { id: params.inviteId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
