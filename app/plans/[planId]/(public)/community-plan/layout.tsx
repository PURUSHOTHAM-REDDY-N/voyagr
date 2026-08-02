import Header from "@/components/plan/Header";
import PlanLayoutContent from "@/components/plan/PlanLayoutContent";
import { Metadata, ResolvingMetadata } from "next";
import { db } from "@/lib/db";

export async function generateMetadata(
  {
    params,
  }: {
    params: { planId: string };
  },
  parent: ResolvingMetadata
): Promise<Metadata> {
  try {
    const plan = await db.plan.findUnique({ where: { id: params.planId } });
    const planSettings = await db.planSettings.findUnique({ where: { planId: params.planId } });
    if (!plan || !planSettings || !planSettings.isPublished) {
      throw new Error("Plan not found or not public");
    }
    return {
      title: plan.nameoftheplace,
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
      <Header isPublic={true} />
      <main className="flex min-h-[calc(100svh-4rem)] flex-col items-center bg-blue-50/40 dark:bg-background">
        <PlanLayoutContent planId={params.planId} isPublic={true}>
          {children}
        </PlanLayoutContent>
      </main>
    </>
  );
}
