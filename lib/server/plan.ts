import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-utils";

export async function getPlanAdmin(planId: string, userId: string) {
  const plan = await db.plan.findUnique({ where: { id: planId } });
  if (plan && plan.userId === userId) {
    return { isPlanAdmin: true, planName: plan.nameoftheplace };
  }
  return { isPlanAdmin: false, planName: "" };
}

export async function getSharedPlans(userId: string) {
  const accessRecords = await db.access.findMany({ where: { userId } });
  if (!accessRecords.length) return [];

  const planIds = accessRecords.map((record) => record.planId);
  const plans = await db.plan.findMany({ where: { id: { in: planIds } } });
  return plans;
}

/** Mirrors convex/plan.ts's validatePlanAccess - throws if the plan doesn't exist or the user has no access. */
export async function validatePlanAccess(planId: string, userId: string) {
  const plan = await db.plan.findUnique({ where: { id: planId } });
  if (!plan) {
    throw new ApiError("Plan not found", 404);
  }

  const isPlanAdmin = plan.userId === userId;
  if (!isPlanAdmin) {
    const access = await db.access.findFirst({ where: { planId, userId } });
    if (!access) {
      throw new ApiError("Unauthorized access to plan", 403);
    }
  }
  return { plan, isPlanAdmin };
}
