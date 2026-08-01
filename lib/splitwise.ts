/**
 * Splitwise-style expense splitting: turning "who's involved and how" into
 * exact per-person amounts, and turning a pile of expenses into "who owes
 * whom". Pure functions, no I/O - shared between the add-expense form
 * (components/expenseTracker/ExpenseSheet.tsx) and the balances view
 * (components/expenseTracker/Balances.tsx).
 */

export type SplitMethod = "equally" | "exact" | "percentage" | "shares";

export type ExpenseSplitInput = { userId: string; amount: number };

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Splits `total` evenly across participantIds, distributing leftover cents to the first few so the sum is exact. */
function distributeEqually(total: number, participantIds: string[]): ExpenseSplitInput[] {
  const base = Math.floor((total / participantIds.length) * 100) / 100;
  const splits = participantIds.map((userId) => ({ userId, amount: base }));
  let remainderCents = Math.round((total - base * participantIds.length) * 100);
  for (let i = 0; remainderCents > 0 && i < splits.length; i++) {
    splits[i] = { ...splits[i], amount: round2(splits[i].amount + 0.01) };
    remainderCents--;
  }
  return splits;
}

/** Rounds each entry to the cent, then nudges entries by 1c at a time until the sum matches `total` exactly. */
function roundToSumExactly(total: number, entries: { userId: string; raw: number }[]): ExpenseSplitInput[] {
  const rounded = entries.map((e) => ({ userId: e.userId, amount: round2(e.raw) }));
  const sum = round2(rounded.reduce((s, e) => s + e.amount, 0));
  let diffCents = Math.round((total - sum) * 100);
  let i = 0;
  while (diffCents !== 0 && rounded.length > 0) {
    const idx = i % rounded.length;
    rounded[idx] = { ...rounded[idx], amount: round2(rounded[idx].amount + (diffCents > 0 ? 0.01 : -0.01)) };
    diffCents += diffCents > 0 ? -1 : 1;
    i++;
  }
  return rounded;
}

/**
 * Normalizes any split-entry method into exact per-person amounts that sum
 * to exactly `total` (to the cent). `rawValues` is ignored for "equally";
 * for "exact" it's dollar amounts, for "percentage" it's percentages
 * (0-100), for "shares" it's relative weights (e.g. 2 vs 1).
 */
export function normalizeSplit(
  total: number,
  participantIds: string[],
  method: SplitMethod,
  rawValues: Record<string, number>
): ExpenseSplitInput[] {
  if (participantIds.length === 0) return [];

  if (method === "equally") {
    return distributeEqually(total, participantIds);
  }

  if (method === "exact") {
    return participantIds.map((userId) => ({ userId, amount: round2(rawValues[userId] || 0) }));
  }

  if (method === "percentage") {
    return roundToSumExactly(
      total,
      participantIds.map((userId) => ({ userId, raw: (total * (rawValues[userId] || 0)) / 100 }))
    );
  }

  // shares
  const totalShares = participantIds.reduce((sum, id) => sum + (rawValues[id] || 0), 0);
  if (totalShares <= 0) return distributeEqually(total, participantIds);
  return roundToSumExactly(
    total,
    participantIds.map((userId) => ({ userId, raw: (total * (rawValues[userId] || 0)) / totalShares }))
  );
}

export function validateSplit(
  total: number,
  method: SplitMethod,
  participantIds: string[],
  rawValues: Record<string, number>
): { valid: boolean; message?: string } {
  if (participantIds.length === 0) {
    return { valid: false, message: "Select at least one person to split with" };
  }

  if (method === "exact") {
    const sum = round2(participantIds.reduce((s, id) => s + (rawValues[id] || 0), 0));
    if (Math.abs(sum - total) > 0.01) {
      return { valid: false, message: `Amounts must add up to the total (currently ${sum.toFixed(2)} of ${total.toFixed(2)})` };
    }
  }

  if (method === "percentage") {
    const sum = round2(participantIds.reduce((s, id) => s + (rawValues[id] || 0), 0));
    if (Math.abs(sum - 100) > 0.5) {
      return { valid: false, message: `Percentages must add up to 100% (currently ${sum.toFixed(1)}%)` };
    }
  }

  if (method === "shares") {
    const sum = participantIds.reduce((s, id) => s + (rawValues[id] || 0), 0);
    if (sum <= 0) {
      return { valid: false, message: "Enter at least one share" };
    }
  }

  return { valid: true };
}

type SplitExpense = { userId: string; amount: number; splits: { userId: string; amount: number }[] };

/**
 * Net balance per person across a set of expenses: positive = they're owed
 * money, negative = they owe money. Expenses with no splits (added before
 * this feature existed, or intentionally not shared) are excluded entirely
 * rather than guessing who benefited from them.
 */
export function computeBalances(expenses: SplitExpense[]): Record<string, number> {
  const balances: Record<string, number> = {};
  for (const expense of expenses) {
    if (!expense.splits || expense.splits.length === 0) continue;
    balances[expense.userId] = round2((balances[expense.userId] || 0) + expense.amount);
    for (const split of expense.splits) {
      balances[split.userId] = round2((balances[split.userId] || 0) - split.amount);
    }
  }
  return balances;
}

export type SettleUpTransaction = { from: string; to: string; amount: number };

/**
 * Greedy debt simplification: repeatedly matches the biggest debtor against
 * the biggest creditor, minimizing the number of settle-up transactions
 * needed to zero everyone out (the classic Splitwise "simplify debts" view).
 */
export function simplifyDebts(balances: Record<string, number>): SettleUpTransaction[] {
  const creditors = Object.entries(balances)
    .filter(([, amount]) => amount > 0.01)
    .map(([userId, amount]) => ({ userId, amount }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = Object.entries(balances)
    .filter(([, amount]) => amount < -0.01)
    .map(([userId, amount]) => ({ userId, amount: -amount }))
    .sort((a, b) => b.amount - a.amount);

  const transactions: SettleUpTransaction[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = round2(Math.min(debtors[i].amount, creditors[j].amount));
    if (amount > 0.01) {
      transactions.push({ from: debtors[i].userId, to: creditors[j].userId, amount });
    }
    debtors[i] = { ...debtors[i], amount: round2(debtors[i].amount - amount) };
    creditors[j] = { ...creditors[j], amount: round2(creditors[j].amount - amount) };
    if (debtors[i].amount <= 0.01) i++;
    if (creditors[j].amount <= 0.01) j++;
  }
  return transactions;
}
