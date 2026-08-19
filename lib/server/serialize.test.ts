import { serializePlanSettings } from "./serialize";

describe("serializePlanSettings", () => {
  it("returns undefined for both dates when planSettings is null", () => {
    expect(serializePlanSettings(null)).toEqual({ fromDate: undefined, toDate: undefined });
  });

  it("converts both dates to epoch milliseconds when both are set", () => {
    const fromDate = new Date("2026-06-01T00:00:00.000Z");
    const toDate = new Date("2026-06-05T00:00:00.000Z");
    const result = serializePlanSettings({ fromDate, toDate });
    expect(result.fromDate).toBe(fromDate.getTime());
    expect(result.toDate).toBe(toDate.getTime());
  });

  it("returns undefined for fromDate when it is null, independent of toDate", () => {
    const toDate = new Date("2026-06-05T00:00:00.000Z");
    const result = serializePlanSettings({ fromDate: null, toDate });
    expect(result.fromDate).toBeUndefined();
    expect(result.toDate).toBe(toDate.getTime());
  });

  it("returns undefined for toDate when it is null, independent of fromDate", () => {
    const fromDate = new Date("2026-06-01T00:00:00.000Z");
    const result = serializePlanSettings({ fromDate, toDate: null });
    expect(result.fromDate).toBe(fromDate.getTime());
    expect(result.toDate).toBeUndefined();
  });

  it("returns undefined for both dates when both are null", () => {
    const result = serializePlanSettings({ fromDate: null, toDate: null });
    expect(result.fromDate).toBeUndefined();
    expect(result.toDate).toBeUndefined();
  });

  it("returns undefined for both dates when both are simply unset", () => {
    const result = serializePlanSettings({});
    expect(result.fromDate).toBeUndefined();
    expect(result.toDate).toBeUndefined();
  });

  it("preserves other fields on the object via the spread", () => {
    const result = serializePlanSettings({
      fromDate: null,
      toDate: null,
      currencyCode: "USD",
    } as any);
    expect(result).toMatchObject({ currencyCode: "USD" });
  });
});
