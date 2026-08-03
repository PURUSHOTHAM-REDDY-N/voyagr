import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId, handleApiError } from "@/lib/api-utils";
import { validatePlanAccess } from "@/lib/server/plan";

export async function GET(
  _req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const userId = await requireUserId();
    const { planId } = params;

    // Now returns every collaborator's email/name (needed for the expense
    // split picker), not just the caller's - validate the caller actually
    // has access to this plan before returning that.
    const { plan: planRecord } = await validatePlanAccess(planId, userId);

    // Was filtered to { planId, userId } (only the caller's own Access row),
    // ported as-is from convex/plan.ts's getAllUsersForAPlan bug during the
    // migration. Now fixed: expense splitting needs the full collaborator
    // list to pick who to split with, not just the caller.
    const accessRecords = await db.access.findMany({ where: { planId } });

    const userIds = [planRecord.userId, ...accessRecords.map((a) => a.userId)];
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    return NextResponse.json(
      users.map((user) => ({ ...user, IsCurrentUser: user.id === userId }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}
