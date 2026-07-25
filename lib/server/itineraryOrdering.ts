const DAY_TITLE_PREFIX_PATTERN = /^Day\s+\d+\s*:?\s*/i;

/**
 * Renumbers "Day N" prefixes sequentially, preserving whatever descriptive
 * suffix (or lack of one) each day already had. Used after any operation
 * that inserts, removes, or moves a day, so the numbering always matches
 * array position - deleting Day 3 from a 5-day trip leaves Day 1, 2, 3, 4
 * behind, not Day 1, 2, 4, 5.
 */
export function renumberItineraryDays<T extends { title: string }>(itinerary: T[]): T[] {
  return itinerary.map((day, index) => {
    const suffix = day.title.replace(DAY_TITLE_PREFIX_PATTERN, "").trim();
    return {
      ...day,
      title: suffix ? `Day ${index + 1}: ${suffix}` : `Day ${index + 1}`,
    };
  });
}

/** Moves the itinerary day at fromIndex to toIndex, then renumbers. */
export function moveItineraryDay<T extends { title: string }>(
  itinerary: T[],
  fromIndex: number,
  toIndex: number
): T[] {
  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    fromIndex >= itinerary.length ||
    toIndex < 0 ||
    toIndex >= itinerary.length
  ) {
    throw new Error(`Invalid move: fromIndex=${fromIndex}, toIndex=${toIndex}, length=${itinerary.length}`);
  }

  const copy = [...itinerary];
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return renumberItineraryDays(copy);
}
