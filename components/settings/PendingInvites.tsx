"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { revokeInvite as revokeInviteRequest } from "@/lib/client/plan";
import { fetcher, FetchError } from "@/lib/fetcher";
import useSWR from "swr";
import { getDisplayName } from "@/lib/utils";
import { useTransition } from "react";

const PendingInvites = ({ planId }: { planId: string }) => {
  const { data: invites, mutate } = useSWR(`/api/plans/${planId}/invites`, fetcher);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  if (!invites || invites.length == 0) return null;

  const revokeEmailInvite = async (id: string, email: string) => {
    try {
      startTransition(async () => {
        await revokeInviteRequest(id);
        mutate();
      });
      toast({
        variant: "default",
        description: `Invite to ${email} has been revoked.`,
      });
    } catch (error) {
      if (error instanceof FetchError) {
        toast({
          title: "Error",
          description: error.message,
        });
      }
    }
  };

  return (
    <div className="mt-5">
      <div className="mb-2 font-bold text-sm">Pending Invites</div>
      <div className="flex flex-col gap-3 max-w-lg">
        {invites.map((invite: any) => (
          <div
            key={invite.id}
            className="px-5 py-2
                        border border-solid border-border
                        shadow-sm rounded-md
                        flex gap-5 justify-between items-center"
          >
            <span className="text-sm text-muted-foreground">
              {getDisplayName(
                invite.firstName,
                invite?.lastName,
                invite?.email
              )}
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => revokeEmailInvite(invite.id, invite.email)}
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

export default PendingInvites;
