import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const DASHBOARD_URL = "/dashboard";

const useAuth = () => {
  const { status } = useSession();
  // next-auth's session status isn't known during SSR (always "loading"
  // there), so gate on status !== "loading" - otherwise a signed-in user's
  // client can resolve "authenticated" before hydration commits, mismatching
  // the server's render (see components/common/Logo.tsx for the concrete
  // symptom the equivalent Clerk gap caused).
  const isAuthenticated = status === "authenticated";
  const isLoading = status === "loading";

  const pathname = usePathname();

  const isCurrentPathDashboard = pathname === DASHBOARD_URL;
  const isCurrentPathHome = pathname === "/";

  const router = useRouter();

  const openSignInPopupOrDirect = () => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push(`/sign-in?callbackUrl=${encodeURIComponent(DASHBOARD_URL)}`);
      return;
    }
    router.push(DASHBOARD_URL);
  };
  return { isCurrentPathDashboard, isCurrentPathHome, openSignInPopupOrDirect, isAuthenticated };
};

export default useAuth;
