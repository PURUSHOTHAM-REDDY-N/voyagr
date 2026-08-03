import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-utils";

const HOUR = 60 * 60 * 1000;

/**
 * Simple fixed-window rate limiter backed by MongoDB, replacing
 * @convex-dev/rate-limiter's component. Not atomic under heavy concurrent
 * load (best-effort, matches this app's scale) - throws ApiError(429) once
 * the window's limit is exceeded.
 */
export async function checkFixedWindowLimit(
  key: string,
  { rate, periodMs }: { rate: number; periodMs: number }
) {
  const now = new Date();
  const existing = await db.rateLimit.findUnique({ where: { key } });

  if (!existing || now.getTime() - existing.windowStart.getTime() > periodMs) {
    await db.rateLimit.upsert({
      where: { key },
      update: { count: 1, windowStart: now },
      create: { key, count: 1, windowStart: now },
    });
    return;
  }

  if (existing.count >= rate) {
    throw new ApiError("Rate limit exceeded, please try again later.", 429);
  }

  await db.rateLimit.update({
    where: { key },
    data: { count: { increment: 1 } },
  });
}

export const sendEmailInviteLimit = (userId: string) =>
  checkFixedWindowLimit(`sendEmailInvite:${userId}`, { rate: 3, periodMs: 24 * HOUR });
