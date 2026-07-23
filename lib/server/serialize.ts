/**
 * Convex stored `fromDate`/`toDate` as raw epoch-millis numbers, and the
 * frontend still works with numbers (Date.getTime()) everywhere. Prisma
 * models them as DateTime, so translate back to numbers at the API boundary
 * to keep frontend code unchanged.
 */
export function serializePlanSettings(
  planSettings: {
    fromDate?: Date | null;
    toDate?: Date | null;
  } | null
) {
  if (!planSettings) {
    return { fromDate: undefined, toDate: undefined };
  }
  return {
    ...planSettings,
    fromDate: planSettings.fromDate ? planSettings.fromDate.getTime() : undefined,
    toDate: planSettings.toDate ? planSettings.toDate.getTime() : undefined,
  };
}
