"use client";
import { ReactNode } from "react";
import { useSession } from "next-auth/react";

/**
 * Drop-in replacements for convex/react's <Authenticated>/<Unauthenticated>/
 * <AuthLoading>, originally built on Clerk's auth state and now on
 * next-auth's useSession() - kept as small wrapper components (rather than
 * switching every call site) to minimize the diff across header components.
 */

export function AuthLoading({ children }: { children: ReactNode }) {
  const { status } = useSession();
  return status === "loading" ? <>{children}</> : null;
}

export function Authenticated({ children }: { children: ReactNode }) {
  const { status } = useSession();
  return status === "authenticated" ? <>{children}</> : null;
}

export function Unauthenticated({ children }: { children: ReactNode }) {
  const { status } = useSession();
  return status === "unauthenticated" ? <>{children}</> : null;
}
