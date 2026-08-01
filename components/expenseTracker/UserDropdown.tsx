import { SelectItem } from "@/components/ui/select";
import { UserIcon } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { User } from "@prisma/client";

const UserDropdown = ({
  planId,
  userId,
}: {
  planId: string;
  userId: string;
}) => {
  const { data: sharedUserList } = useSWR(`/api/plans/${planId}/users`, fetcher);

  const getDisplayName = (userObject: User) => {
    if (!userObject.firstName && !userObject.lastName) return userObject.email;
    if (userObject.firstName && userObject.firstName.length > 0)
      return (
        userObject.firstName +
        (userObject.lastName ? ` ${userObject.lastName}` : "")
      );
  };

  return sharedUserList?.map((userObject: User & { IsCurrentUser: boolean }) => (
    <SelectItem value={userObject.id} key={userObject.id}>
      <div className="flex gap-2 items-center">
        <UserIcon className="h-4 w-4" />
        <span>
          {getDisplayName(userObject)} {userObject.IsCurrentUser && "(You)"}
        </span>
      </div>
    </SelectItem>
  ));
};

export default UserDropdown;
