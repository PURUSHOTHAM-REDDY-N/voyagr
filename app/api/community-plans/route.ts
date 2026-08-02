import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-utils";

// Replaces convex/communityPlans.ts's paginatedPublishedPlans (Convex's
// paginationOptsValidator/usePaginatedQuery) with plain cursor pagination -
// see hooks/useCommunityPlans.ts on the frontend for the useSWRInfinite consumer.
export async function GET(req: NextRequest) {
  try {
    const companion = req.nextUrl.searchParams.get("companion") ?? undefined;
    const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined;
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? 9);

    const settingsPage = await db.planSettings.findMany({
      where: { isPublished: true, ...(companion ? { companion } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const plans = await Promise.all(
      settingsPage.map(async (setting) => {
        const plan = await db.plan.findUnique({ where: { id: setting.planId } });
        if (!plan) return null;
        return {
          ...plan,
          isSharedPlan: false,
          fromDate: setting.fromDate?.getTime(),
          toDate: setting.toDate?.getTime(),
        };
      })
    );

    const items = plans.filter((p) => p !== null);
    const nextCursor =
      settingsPage.length === limit ? settingsPage[settingsPage.length - 1].id : null;

    return NextResponse.json({ items, nextCursor });
  } catch (error) {
    return handleApiError(error);
  }
}
