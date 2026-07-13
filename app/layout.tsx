import type { Metadata } from "next";
import { Montserrat_Alternates } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import Providers from "@/app/Providers";
import { ThemeProvider } from "@/contexts/ThemeProvider";

import Progress from "@/components/Progress";
import { Toaster } from "@/components/ui/toaster";

import "./globals.css";

const inter = Montserrat_Alternates({ weight: "500", subsets: ["cyrillic"] });

export const metadata: Metadata = {
  // TODO: point this at Voyagr's real domain once one is chosen; the old
  // travelplannerai.site domain is no longer accurate.
  metadataBase: new URL("https://www.travelplannerai.site"),
  title: {
    default: "Voyagr - Your Smart, Free Travel Planner",
    template: "%s | Voyagr - Your Smart, Free Travel Planner",
  },
  description:
    "Voyagr provides intelligent travel suggestions, personalized itineraries, and seamless trip planning - completely free. Plan your perfect trip with ease.",
  keywords:
    "travel planner, AI travel planner, free travel planner, smart travel, travel suggestions, destination insights, personalized itineraries, trip planning, travel tips, vacation planning",
  openGraph: {
    title: "Voyagr - Your Smart, Free Travel Planner",
    description:
      "Voyagr provides intelligent travel suggestions, personalized itineraries, and seamless trip planning - completely free. Plan your perfect trip with ease.",
    url: "https://www.travelplannerai.site",
    type: "website",
    siteName: "Voyagr",
    images: [
      {
        url: "opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Voyagr",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <Providers>{children}</Providers>
          <Progress />
          <Analytics />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
