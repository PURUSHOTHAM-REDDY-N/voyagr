import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-utils";

/**
 * convex/plan.ts's getPublicPlans hardcoded a list of Convex document IDs to
 * showcase on the homepage. Those IDs are meaningless after the MongoDB
 * migration (they referenced Convex documents, not Mongo ones), so this is
 * replaced with "most recently published plans" instead of a curated list.
 * Re-curate by hand later if you want specific plans featured.
 */
export async function GET() {
  try {
    const publishedSettings = await db.planSettings.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    const plans = await Promise.all(
      publishedSettings.map(async (setting) => {
        const plan = await db.plan.findUnique({ where: { id: setting.planId } });
        if (!plan) return null;
        return { ...plan, isSharedPlan: false };
      })
    );

    return NextResponse.json(plans.filter((p) => p !== null));
  } catch (error) {
    return handleApiError(error);
  }
}
