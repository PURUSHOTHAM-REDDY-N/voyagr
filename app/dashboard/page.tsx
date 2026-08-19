import Dashboard from "@/components/dashboard/Dashboard";
import { Metadata } from "next";

// Plan creation here kicks off itinerary/image generation via a Server
// Action (lib/actions/generateplanAction.ts, generateEmptyPlanAction.ts)
// that redirects almost immediately and continues the actual generation
// through Vercel's waitUntil. Without raising this above the platform
// default, Vercel can still kill that work partway through on longer,
// multi-chunk itineraries - see the "use server" files' notes on why this
// config can't live there directly.
export const maxDuration = 300;

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Travel Planner AI provides intelligent travel suggestions, personalized itineraries, and seamless trip planning. Plan your perfect trip with ease.",
  keywords:
    "travel planner, AI travel planner, smart travel, travel suggestions, destination insights, personalized itineraries, trip planning, travel tips, vacation planning",

  openGraph: {
    title: "Travel Planner AI - Your Smart Travel Planner",
    description:
      "Travel Planner AI provides intelligent travel suggestions, personalized itineraries, and seamless trip planning. Plan your perfect trip with ease.",
    url: "https://www.travelplannerai.site",
    type: "website",
    siteName: "TravelPlannerAI",
    images: [
      {
        url: "https://www.travelplannerai.site/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Travel Planner AI",
      },
    ],
  },
};

export default function DashboardPage() {
  return <Dashboard />;
}
