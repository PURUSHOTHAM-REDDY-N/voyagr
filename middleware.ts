import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

// Built from the edge-safe config only (no Credentials provider - that needs
// Prisma + bcrypt, neither of which run in the Edge Runtime middleware
// executes in). This instance only ever reads/verifies the session JWT
// already on the request; it never calls authorize().
const { auth } = NextAuth(authConfig);

const PUBLIC_PAGE_ROUTES = ["/", "/community-plans", "/sign-in", "/sign-up"];

function isPublicPagePath(pathname: string): boolean {
  if (PUBLIC_PAGE_ROUTES.includes(pathname)) return true;
  // /plans/:planId/community-plan and its sub-paths
  if (/^\/plans\/[^/]+\/community-plan(\/.*)?$/.test(pathname)) return true;
  return false;
}

// API routes are intentionally not gated here (unlike Clerk's authMiddleware,
// which protected everything not in an explicit publicRoutes allowlist) -
// every non-public API route already calls requireUserId() itself
// (verified: every app/api/**/route.ts either does, or is one of the
// deliberately public ones: weather, plans/public, community-plans, the
// auth endpoints themselves). This avoids maintaining two parallel
// allowlists that can drift out of sync.
export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api") || isPublicPagePath(pathname)) {
    return NextResponse.next();
  }

  if (!req.auth) {
    const signInUrl = new URL("/sign-in", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
