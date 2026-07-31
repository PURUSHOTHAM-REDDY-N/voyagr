"use client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { getDisplayName } from "@/lib/utils";
import { revokeAccess as revokeAccessRequest } from "@/lib/client/plan";
import { fetcher } from "@/lib/fetcher";
import useSWR from "swr";
import { useTransition } from "react";

const AccessRecords = ({ planId }: { planId: string }) => {
  const { data: records, mutate } = useSWR(`/api/plans/${planId}/access`, fetcher);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const revokeEmailInvite = async (id: string, email: string) => {
    startTransition(async () => {
      await revokeAccessRequest(id);
      mutate();
    });
    toast({
      variant: "default",
      description: `Access of this plan from ${email} has been revoked.`,
    });
  };

  if (!records || records.length === 0) return null;
  return (
    <div className="mt-5">
      <div className="mb-2 font-bold text-sm">
        People having access to this plan
      </div>
      <div className="flex flex-col gap-3 max-w-lg">
        {records.map((record: any) => (
          <div
            key={record.id}
            className="px-5 py-2
                        border border-solid border-border
                        shadow-sm rounded-md
                        flex gap-5 justify-between items-center"
          >
            <span className="text-sm text-muted-foreground">
              {getDisplayName(record.firstName, record.lastName, record.email)}
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => revokeEmailInvite(record.id, record.email)}
              disabled={isPending}
            >
              Revoke
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AccessRecords;
