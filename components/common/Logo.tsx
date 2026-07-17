import {useSession} from "next-auth/react";
import {MapPinIcon} from "lucide-react";
import Link from "next/link";

export default function Logo() {
  const {status} = useSession();
  // Session status isn't known during SSR (always "loading" there), so gate
  // on status to keep the client's first render matching the server's -
  // flipping to /dashboard only after hydration has committed, same pattern
  // as components/auth/AuthState.tsx.
  const isAuthenticated = status === "authenticated";

  return (
    <div className="hidden md:flex gap-10 items-center justify-start flex-1">
      <Link href={isAuthenticated ? "/dashboard" : "/"}>
        <div className="flex gap-1 justify-center items-center">
          <MapPinIcon className="h-10 w-10 text-blue-500" />
          <div className="flex flex-col leading-5 font-bold text-xl">
            <span>
              Voy<span className="text-blue-500">agr</span>
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}
