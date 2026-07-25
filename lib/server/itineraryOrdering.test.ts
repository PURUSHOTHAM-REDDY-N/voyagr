import { renumberItineraryDays, moveItineraryDay } from "./itineraryOrdering";

describe("renumberItineraryDays", () => {
  it("renumbers plain 'Day N' titles sequentially by array position", () => {
    const result = renumberItineraryDays([{ title: "Day 1" }, { title: "Day 2" }, { title: "Day 3" }]);
    expect(result.map((d) => d.title)).toEqual(["Day 1", "Day 2", "Day 3"]);
  });

  it("closes the gap left by a deleted day", () => {
    // Day 3 was deleted from a 5-day trip - the remaining 4 should become 1-4, not 1,2,4,5
    const result = renumberItineraryDays([
      { title: "Day 1" },
      { title: "Day 2" },
      { title: "Day 4" },
      { title: "Day 5" },
    ]);
    expect(result.map((d) => d.title)).toEqual(["Day 1", "Day 2", "Day 3", "Day 4"]);
  });

  it("preserves a descriptive suffix while renumbering", () => {
    const result = renumberItineraryDays([{ title: "Day 3: Explore the Old Town" }]);
    expect(result[0].title).toBe("Day 1: Explore the Old Town");
  });

  it("preserves other fields on the day object", () => {
    const result = renumberItineraryDays([{ title: "Day 2", activities: { morning: [] } }]);
    expect(result[0]).toEqual({ title: "Day 1", activities: { morning: [] } });
  });

  it("handles titles without a 'Day N' prefix at all by treating the whole thing as the suffix", () => {
    const result = renumberItineraryDays([{ title: "New Day" }]);
    expect(result[0].title).toBe("Day 1: New Day");
  });
});

describe("moveItineraryDay", () => {
  const days = (titles: string[]) => titles.map((title) => ({ title }));

  it("moves a day earlier and renumbers so content follows the move", () => {
    const result = moveItineraryDay(days(["Day 1: Louvre", "Day 2: Eiffel Tower"]), 1, 0);
    expect(result.map((d) => d.title)).toEqual(["Day 1: Eiffel Tower", "Day 2: Louvre"]);
  });

  it("moves a day later and renumbers accordingly", () => {
    const result = moveItineraryDay(days(["Day 1: A", "Day 2: B", "Day 3: C"]), 0, 2);
    expect(result.map((d) => d.title)).toEqual(["Day 1: B", "Day 2: C", "Day 3: A"]);
  });

  it("does not mutate the original array", () => {
    const original = days(["Day 1: A", "Day 2: B"]);
    const originalTitles = original.map((d) => d.title);
    moveItineraryDay(original, 0, 1);
    expect(original.map((d) => d.title)).toEqual(originalTitles);
  });

  it("throws on an out-of-range index rather than silently corrupting order", () => {
    expect(() => moveItineraryDay(days(["Day 1: A"]), 0, 5)).toThrow();
    expect(() => moveItineraryDay(days(["Day 1: A"]), -1, 0)).toThrow();
  });

  it("throws on a non-integer index", () => {
    expect(() => moveItineraryDay(days(["Day 1: A", "Day 2: B"]), 0.5, 1)).toThrow();
  });
});
