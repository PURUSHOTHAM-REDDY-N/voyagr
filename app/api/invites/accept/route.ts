import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId, handleApiError, ApiError } from "@/lib/api-utils";
import { getPlanAdmin } from "@/lib/server/plan";

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const { token } = await req.json();

    const invite = await db.invite.findFirst({ where: { token } });
    if (!invite) {
      throw new ApiError("no invite found with the provided token", 404);
    }

    const userToAdd = await db.user.findUnique({ where: { email: invite.email } });
    if (!userToAdd) {
      throw new ApiError("no user found with the email while giving access to a plan", 404);
    }

    const plan = await db.plan.findUnique({ where: { id: invite.planId } });
    if (!plan) {
      throw new ApiError(`No Plan found while giving access to user ${userToAdd.id}`, 404);
    }

    const adminAccess = await getPlanAdmin(plan.id, userId);
    if (adminAccess.isPlanAdmin) {
      throw new ApiError("You can't join the plan you already own.");
    }

    console.log(
      `grantAccessByToken called by ${userId} on planId : ${plan.id} | userId: ${userToAdd.id} | email: ${userToAdd.email}`
    );

    await db.access.create({
      data: { planId: plan.id, userId: userToAdd.id, email: userToAdd.email },
    });
    await db.invite.delete({ where: { id: invite.id } });

    return NextResponse.json({ planId: plan.id });
  } catch (error) {
    return handleApiError(error);
  }
}
