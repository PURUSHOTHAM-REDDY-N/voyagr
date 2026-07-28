import { NextRequest, NextResponse } from "next/server";
import { requireUserId, handleApiError, ApiError } from "@/lib/api-utils";
import { recommendPois, CandidatePoiInput } from "@/lib/server/recommendationEngine";

/**
 * Standalone entry point into the recommendation engine, independent of plan
 * generation. Exists so the engine's filter/rank pass - the actual
 * "Context-Aware Recommendation System" from the dissertation's Objective 1 -
 * can be benchmarked and tested on its own: it does no LLM call, DB read, or
 * other I/O, so its latency here is just the engine's own compute time
 * (Objective 1's target: <500ms under 100 concurrent requests).
 */
export async function POST(req: NextRequest) {
  const startedAt = performance.now();
  try {
    await requireUserId();

    const body = await req.json();
    const candidates = body?.candidates as CandidatePoiInput[] | undefined;
    if (!Array.isArray(candidates)) {
      throw new ApiError("candidates must be an array of CandidatePoiInput", 400);
    }

    const results = recommendPois(candidates, {
      currentTime: body?.currentTime ? new Date(body.currentTime) : undefined,
      weatherState: body?.weatherState,
      activityPreferences: body?.activityPreferences,
      budget: body?.budget,
      minStayMinutes: body?.minStayMinutes,
    });

    return NextResponse.json({
      results,
      latencyMs: Math.round(performance.now() - startedAt),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
