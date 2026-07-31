"use client";

import { useToast } from "@/components/ui/use-toast";
import { useSession } from "next-auth/react";
import { grantAccessByToken } from "@/lib/client/plan";
import { FetchError, fetcher } from "@/lib/fetcher";
import useSWR from "swr";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import joinNow from "@/public/join-now.svg";

const Join = () => {
  const { status } = useSession();
  const isLoaded = status !== "loading";
  const isSignedIn = status === "authenticated";
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const { toast } = useToast();

  const { data: currentUser } = useSWR(`/api/users/me`, fetcher);

  useEffect(() => {
    if (!isLoaded || !currentUser || !token) return;

    if (!isSignedIn) {
      router.push("/");
    }
    const callGrantAcess = async () => {
      if (token) {
        try {
          const { planId } = await grantAccessByToken(token);

          router.push(`/plans/${planId}/plan`);
          return new Response(null, {
            status: 200,
          });
        } catch (error) {
          console.error(error);
          if (error instanceof FetchError) {
            toast({
              title: "Error",
              description: error.message,
            });
          }
          return new Response("token error", {
            status: 400,
          });
        }
      }
    };

    callGrantAcess();
  }, [isLoaded, isSignedIn, token, currentUser]);
  return (
    <div className="w-full h-full flex flex-1 justify-center items-center">
      <div className="flex flex-col justify-center items-center gap-5 bg-muted rounded-full p-10 shadow-">
        <Image
          alt="Joining the plan image"
          src={joinNow}
          width={300}
          height={300}
          className="bg-contain"
        />
        <h2 className="text-foreground animate-pulse font-bold text-lg">
          Joining the Plan...
        </h2>
      </div>
    </div>
  );
};

export default Join;
