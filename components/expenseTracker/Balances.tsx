"use client";
import useSWR from "swr";
import { useMemo } from "react";
import { fetcher } from "@/lib/fetcher";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computeBalances, simplifyDebts } from "@/lib/splitwise";
import type { Expense } from "@prisma/client";
import { ArrowRight, Scale } from "lucide-react";
import currencies from "@/lib/currencies.json";

type Collaborator = { id: string; email: string; firstName: string | null; lastName: string | null };
type ExpenseWithSplits = Expense & { splits: { userId: string; amount: number }[] };

const Balances = ({
  planId,
  expenses,
  preferredCurrency,
}: {
  planId: string;
  expenses: ExpenseWithSplits[];
  preferredCurrency: string;
}) => {
  const { data: collaborators } = useSWR<Collaborator[]>(`/api/plans/${planId}/users`, fetcher);

  const balances = useMemo(() => computeBalances(expenses), [expenses]);
  const settleUp = useMemo(() => simplifyDebts(balances), [balances]);

  const currency = currencies.find((c) => c.cc.includes(preferredCurrency))?.symbol ?? preferredCurrency;

  const nameFor = (userId: string) => {
    const collaborator = collaborators?.find((c) => c.id === userId);
    if (!collaborator) return "Someone";
    return collaborator.firstName || collaborator.email;
  };

  // Only show once at least one expense actually has a split - otherwise
  // this card would just be dead weight for plans made before splitting
  // existed, or for anyone who never uses it.
  const hasSharedExpenses = expenses.some((e) => e.splits && e.splits.length > 0);
  if (!hasSharedExpenses) return null;

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Scale className="h-4 w-4" /> Balances
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {settleUp.length === 0 ? (
          <p className="text-sm text-muted-foreground">Everyone&apos;s settled up.</p>
        ) : (
          settleUp.map((transaction, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <span className="font-medium">{nameFor(transaction.from)}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-medium">{nameFor(transaction.to)}</span>
              <span className="ml-auto font-semibold">
                {currency}
                {transaction.amount.toFixed(2)}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default Balances;
