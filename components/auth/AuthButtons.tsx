"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CircleUserRound, LogOut } from "lucide-react";

/**
 * Drop-in replacements for Clerk's <SignInButton>/<UserButton>, matching the
 * same call signature (mode/afterSignInUrl, afterSignOutUrl) so every header
 * component that rendered them needed no other changes - just the import.
 */

export function SignInButton({
  afterSignInUrl = "/dashboard",
}: {
  mode?: "modal" | "redirect";
  afterSignInUrl?: string;
}) {
  return (
    <Button asChild variant="default" size="sm">
      <Link href={`/sign-in?callbackUrl=${encodeURIComponent(afterSignInUrl)}`}>Sign in</Link>
    </Button>
  );
}

export function UserButton({ afterSignOutUrl = "/" }: { afterSignOutUrl?: string }) {
  const { data: session } = useSession();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <CircleUserRound className="h-6 w-6" />
          <span className="sr-only">Account menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {session?.user?.email && (
          <>
            <DropdownMenuLabel className="font-normal text-xs text-muted-foreground truncate">
              {session.user.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={() => signOut({ callbackUrl: afterSignOutUrl })}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
