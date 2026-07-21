//Since the map will be laoded and displayed on client side
"use client";

import {SkeletonForTopPlacesToVisit} from "@/components/sections/TopPlacesToVisit";
// Import necessary modules and functions from external libraries and our own project
import {useJsApiLoader} from "@react-google-maps/api";
import {ReactNode} from "react";
import {GOOGLE_MAPS_LIBRARIES} from "@/lib/googleMapsLibraries";

// Define a function component called MapProvider that takes a children prop
export function MapProvider({children, isLoading}: {children: ReactNode; isLoading: boolean}) {
  // Load the Google Maps JavaScript API asynchronously
  const {isLoaded: scriptLoaded, loadError} = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  if (loadError) return <p>Encountered error while loading google maps</p>;

  if (!scriptLoaded || isLoading) return <SkeletonForTopPlacesToVisit isMaps />;

  // Return the children prop wrapped by this MapProvider component
  return children;
}
