import { normalizeSplit, validateSplit, computeBalances, simplifyDebts } from "./splitwise";

describe("normalizeSplit", () => {
  it("splits evenly and distributes remainder cents so the sum matches exactly", () => {
    const result = normalizeSplit(100, ["a", "b", "c"], "equally", {});
    const sum = result.reduce((s, r) => s + r.amount, 0);
    expect(Math.round(sum * 100) / 100).toBe(100);
    expect(result.map((r) => r.amount).sort()).toEqual([33.33, 33.33, 33.34]);
  });

  it("handles a single participant taking the whole amount", () => {
    const result = normalizeSplit(42.5, ["a"], "equally", {});
    expect(result).toEqual([{ userId: "a", amount: 42.5 }]);
  });

  it("returns an empty array with no participants", () => {
    expect(normalizeSplit(100, [], "equally", {})).toEqual([]);
  });

  it("passes exact amounts through, rounded to the cent", () => {
    const result = normalizeSplit(100, ["a", "b"], "exact", { a: 60.017, b: 39.983 });
    expect(result).toEqual([
      { userId: "a", amount: 60.02 },
      { userId: "b", amount: 39.98 },
    ]);
  });

  it("treats a missing exact value as zero", () => {
    const result = normalizeSplit(100, ["a", "b"], "exact", { a: 100 });
    expect(result).toEqual([
      { userId: "a", amount: 100 },
      { userId: "b", amount: 0 },
    ]);
  });

  it("converts percentages to amounts summing exactly to the total", () => {
    const result = normalizeSplit(90, ["a", "b", "c"], "percentage", { a: 33.33, b: 33.33, c: 33.34 });
    const sum = result.reduce((s, r) => s + r.amount, 0);
    expect(Math.round(sum * 100) / 100).toBe(90);
  });

  it("converts relative shares to proportional amounts summing exactly to the total", () => {
    // 2:1:1 shares of 100 -> 50/25/25
    const result = normalizeSplit(100, ["a", "b", "c"], "shares", { a: 2, b: 1, c: 1 });
    const byId = Object.fromEntries(result.map((r) => [r.userId, r.amount]));
    expect(byId).toEqual({ a: 50, b: 25, c: 25 });
  });

  it("falls back to an equal split when shares are all zero", () => {
    const result = normalizeSplit(90, ["a", "b", "c"], "shares", {});
    const sum = result.reduce((s, r) => s + r.amount, 0);
    expect(Math.round(sum * 100) / 100).toBe(90);
    expect(result.every((r) => r.amount === 30)).toBe(true);
  });
});

describe("validateSplit", () => {
  it("rejects an empty participant list", () => {
    expect(validateSplit(100, "equally", [], {}).valid).toBe(false);
  });

  it("accepts equally with any participants regardless of rawValues", () => {
    expect(validateSplit(100, "equally", ["a", "b"], {}).valid).toBe(true);
  });

  it("rejects exact amounts that don't sum to the total", () => {
    const result = validateSplit(100, "exact", ["a", "b"], { a: 40, b: 40 });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/80\.00 of 100\.00/);
  });

  it("accepts exact amounts within a cent of the total", () => {
    expect(validateSplit(100, "exact", ["a", "b"], { a: 50.005, b: 49.995 }).valid).toBe(true);
  });

  it("rejects percentages that don't sum to 100", () => {
    const result = validateSplit(100, "percentage", ["a", "b"], { a: 40, b: 40 });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/100%/);
  });

  it("accepts percentages within half a point of 100", () => {
    expect(validateSplit(100, "percentage", ["a", "b"], { a: 50.3, b: 50.1 }).valid).toBe(true);
  });

  it("rejects all-zero shares", () => {
    const result = validateSplit(100, "shares", ["a", "b"], { a: 0, b: 0 });
    expect(result.valid).toBe(false);
  });

  it("accepts any positive total shares", () => {
    expect(validateSplit(100, "shares", ["a", "b"], { a: 1, b: 3 }).valid).toBe(true);
  });
});

describe("computeBalances", () => {
  it("excludes expenses with no splits entirely", () => {
    const balances = computeBalances([{ userId: "a", amount: 100, splits: [] }]);
    expect(balances).toEqual({});
  });

  it("nets a single shared expense to zero across participants", () => {
    const balances = computeBalances([
      {
        userId: "a",
        amount: 90,
        splits: [
          { userId: "a", amount: 30 },
          { userId: "b", amount: 30 },
          { userId: "c", amount: 30 },
        ],
      },
    ]);
    expect(balances.a).toBe(60);
    expect(balances.b).toBe(-30);
    expect(balances.c).toBe(-30);
  });

  it("accumulates across multiple expenses paid by different people", () => {
    // A pays 90 split 3 ways (30 each), B pays 30 split 3 ways (10 each)
    const balances = computeBalances([
      {
        userId: "A",
        amount: 90,
        splits: [
          { userId: "A", amount: 30 },
          { userId: "B", amount: 30 },
          { userId: "C", amount: 30 },
        ],
      },
      {
        userId: "B",
        amount: 30,
        splits: [
          { userId: "A", amount: 10 },
          { userId: "B", amount: 10 },
          { userId: "C", amount: 10 },
        ],
      },
    ]);
    expect(balances).toEqual({ A: 50, B: -10, C: -40 });
  });
});

describe("simplifyDebts", () => {
  it("produces no transactions when everyone is already settled", () => {
    expect(simplifyDebts({ a: 0, b: 0.005, c: -0.005 })).toEqual([]);
  });

  it("settles a single debtor/creditor pair directly", () => {
    const result = simplifyDebts({ a: 50, b: -50 });
    expect(result).toEqual([{ from: "b", to: "a", amount: 50 }]);
  });

  it("minimizes transactions for a 3-person imbalance (matches the classic Splitwise result)", () => {
    // From the computeBalances 3-person test: A is owed 50, B owes 10, C owes 40
    const result = simplifyDebts({ A: 50, B: -10, C: -40 });
    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        { from: "C", to: "A", amount: 40 },
        { from: "B", to: "A", amount: 10 },
      ])
    );
  });

  it("every transaction leaves both sides non-negative and the books balance to zero", () => {
    const balances = { a: 120, b: -40, c: -30, d: -50 };
    const result = simplifyDebts(balances);
    const net: Record<string, number> = {};
    for (const { from, to, amount } of result) {
      net[from] = (net[from] || 0) - amount;
      net[to] = (net[to] || 0) + amount;
    }
    for (const [id, balance] of Object.entries(balances)) {
      expect(Math.round((net[id] ?? 0) * 100) / 100).toBe(balance);
    }
  });
});
