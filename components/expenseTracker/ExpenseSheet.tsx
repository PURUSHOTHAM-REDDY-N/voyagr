"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useEffect, useState } from "react";
import { createExpense, updateExpense as updateExpenseRequest } from "@/lib/client/plan";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/lib/fetcher";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { normalizeSplit, validateSplit, type SplitMethod } from "@/lib/splitwise";

import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { expenseCategories } from "@/lib/constants";
import type { Expense } from "@prisma/client";
import UserDropdown from "@/components/expenseTracker/UserDropdown";
import currencies from "@/lib/currencies.json";

const formSchema = z.object({
  purpose: z.string().min(2).max(50),
  category: z.union([
    z.literal("commute"),
    z.literal("food"),
    z.literal("shopping"),
    z.literal("gifts"),
    z.literal("accomodations"),
    z.literal("others"),
  ]),
  amount: z.coerce.number(),
  date: z.date(),
  userId: z.string(),
});

type Collaborator = { id: string; email: string; firstName: string | null; lastName: string | null };

const SPLIT_METHODS: { value: SplitMethod; label: string }[] = [
  { value: "equally", label: "Equally" },
  { value: "exact", label: "Exact" },
  { value: "percentage", label: "%" },
  { value: "shares", label: "Shares" },
];

export default function ExpenseSheet({
  planId,
  data,
  edit,
  preferredCurrency,
}: {
  planId: string;
  edit?: boolean;
  data?: Expense & { splits?: { userId: string; amount: number }[] };
  preferredCurrency: string;
}) {
  if (edit && !data) return;

  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const user = session?.user;
  const { toast } = useToast();

  const { data: collaborators } = useSWR<Collaborator[]>(
    open ? `/api/plans/${planId}/users` : null,
    fetcher
  );

  const [splitMethod, setSplitMethod] = useState<SplitMethod>("equally");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [rawValues, setRawValues] = useState<Record<string, number>>({});
  const [splitError, setSplitError] = useState<string | undefined>();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const watchedAmount = form.watch("amount") || 0;

  useEffect(() => {
    if (!edit) return;
    if (data) {
      form.setValue("purpose", data.purpose);
      form.setValue("amount", data.amount);
      form.setValue("category", data.category);
      form.setValue("userId", data.userId);
      form.setValue("date", new Date(data.date));
    }
  }, [edit, data]);

  // Default to splitting equally between every collaborator - matches
  // Splitwise's default "split with the whole group" behaviour. When
  // editing, reconstruct from the expense's existing splits instead (there's
  // no stored "which method was originally used", so this always shows as
  // exact amounts - the user can switch method to redo it differently).
  useEffect(() => {
    if (!collaborators) return;
    if (edit && data?.splits && data.splits.length > 0) {
      setParticipantIds(data.splits.map((s) => s.userId));
      setRawValues(Object.fromEntries(data.splits.map((s) => [s.userId, s.amount])));
      setSplitMethod("exact");
    } else if (!edit) {
      setParticipantIds(collaborators.map((c) => c.id));
      setRawValues({});
      setSplitMethod("equally");
    }
  }, [collaborators, edit, data]);

  const currency = preferredCurrency
    ? currencies.find((c) => c.cc.includes(preferredCurrency))?.symbol
    : "₹";

  const toggleParticipant = (userId: string, checked: boolean) => {
    setParticipantIds((ids) => (checked ? [...ids, userId] : ids.filter((id) => id !== userId)));
  };

  const getName = (c: Collaborator) => {
    if (!c.firstName) return c.email;
    return c.firstName + (c.lastName ? ` ${c.lastName}` : "");
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user || !user.id) return;

    const validation = validateSplit(values.amount, splitMethod, participantIds, rawValues);
    if (!validation.valid) {
      setSplitError(validation.message);
      toast({ variant: "destructive", title: "Fix the split before saving", description: validation.message });
      return;
    }
    setSplitError(undefined);

    const splits = normalizeSplit(values.amount, participantIds, splitMethod, rawValues);

    form.reset();
    setOpen(false);
    if (edit) {
      await updateExpenseRequest(data?.id!, {
        amount: values.amount,
        category: values.category,
        purpose: values.purpose,
        date: values.date.toISOString(),
        userId: values.userId,
        splits,
      });
    } else {
      await createExpense(planId, {
        userId: values.userId,
        amount: values.amount,
        category: values.category,
        purpose: values.purpose,
        date: values.date.toISOString(),
        splits,
      });
    }
    mutate((key) => typeof key === "string" && key.endsWith("/expenses"));
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {edit ? (
          <span className="hover:underline hover:underline-offset-2 text-blue-600 hover:font-medium cursor-pointer">
            {data?.purpose}
          </span>
        ) : (
          <Button
            size="sm"
            variant="default"
            className="bg-blue-500 hover:bg-blue-700 text-white hover:bg-blue-700hover:text-white"
          >
            Add a New Expense
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{edit ? "Edit Expense" : "Add Expense"}</SheetTitle>
          <SheetDescription>
            {edit ? "Edit" : "Add"} your expenses during the travel to
            efficiently track it at the end.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-8 pt-5"
          >
            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>For</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="What what pupose did you spend?"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Who Paid</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger aria-label="Who Paid">
                        <SelectValue placeholder="Select a User" />
                      </SelectTrigger>
                      <SelectContent>
                        <UserDropdown userId={user!.id} planId={planId} />
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger aria-label="Category">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {expenseCategories.map((category) => (
                          <SelectItem value={category.key} key={category.key}>
                            <div className="flex gap-2 items-center">
                              {category.icon}
                              <span>{category.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount({currency})</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder={`e.g. ${currency} 1000`}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>On</FormLabel>
                  <FormControl>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto p-0 z-50 bg-background"
                        align="start"
                      >
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                        />
                      </PopoverContent>
                    </Popover>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <FormLabel>Split</FormLabel>
              <Tabs value={splitMethod} onValueChange={(v) => setSplitMethod(v as SplitMethod)}>
                <TabsList className="grid grid-cols-4 w-full">
                  {SPLIT_METHODS.map((m) => (
                    <TabsTrigger key={m.value} value={m.value}>
                      {m.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              {!collaborators ? (
                <p className="text-sm text-muted-foreground">Loading collaborators...</p>
              ) : (
                <div className="space-y-2">
                  {collaborators.map((c) => {
                    const checked = participantIds.includes(c.id);
                    return (
                      <div key={c.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => toggleParticipant(c.id, !!v)}
                        />
                        <span className="flex-1 text-sm truncate">{getName(c)}</span>
                        {checked && splitMethod === "equally" && (
                          <span className="text-xs text-muted-foreground w-20 text-right">
                            {currency}
                            {(watchedAmount / (participantIds.length || 1)).toFixed(2)}
                          </span>
                        )}
                        {checked && splitMethod !== "equally" && (
                          <Input
                            type="number"
                            className="w-20 h-8"
                            value={rawValues[c.id] ?? ""}
                            onChange={(e) =>
                              setRawValues((v) => ({ ...v, [c.id]: Number(e.target.value) }))
                            }
                            placeholder={splitMethod === "shares" ? "1" : "0"}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {splitError && <p className="text-sm text-destructive">{splitError}</p>}
            </div>

            <Button
              type="submit"
              variant="outline"
              className={cn("text-white hover:text-white", {
                "bg-teal-500 hover:bg-teal-700": edit,
                "bg-blue-500 hover:bg-blue-700": !edit,
              })}
            >
              {edit ? "Update" : "Add"} Expense
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
