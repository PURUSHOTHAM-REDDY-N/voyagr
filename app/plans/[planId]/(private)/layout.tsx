import { auth } from "@/auth";
import Header from "@/components/plan/Header";
import PlanLayoutContent from "@/components/plan/PlanLayoutContent";
import Progress from "@/components/Progress";
import { Toaster } from "@/components/ui/toaster";
import { Analytics } from "@vercel/analytics/react";
import { Metadata, ResolvingMetadata } from "next";
import { validatePlanAccess } from "@/lib/server/plan";

export async function generateMetadata(
  {
    params,
  }: {
    params: { planId: string };
  },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const session = await auth();
  const userId = session?.user?.id;

  try {
    if (!userId) throw new Error("Unauthorized");
    const { plan } = await validatePlanAccess(params.planId, userId);
    return {
      title: plan ? plan.nameoftheplace : "Your Plan",
    };
  } catch (error) {
    return {
      title: "Unauthorized Access!",
    };
  }
}

export default function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { planId: string };
}) {
  return (
    <>
      <Header isPublic={false} />
      <main className="flex min-h-[calc(100svh-4rem)] flex-col items-center bg-blue-50/40 dark:bg-background">
        <PlanLayoutContent planId={params.planId} isPublic={false}>
          {children}
        </PlanLayoutContent>
        <Progress />
        <Analytics />
        <Toaster />
      </main>
    </>
  );
}
