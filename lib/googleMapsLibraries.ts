import type { Libraries } from "@react-google-maps/api";

/**
 * @react-google-maps/api's useJsApiLoader dedupes multiple calls across
 * different components into a single injected script tag - but only when
 * every call requests the exact same (stable-reference) libraries list. Both
 * MapProvider.tsx and LocationAutoComplete.tsx load the Maps script on the
 * same plan page (the map itself, and the "search new location" input) and
 * must share this constant, or the two loaders race and one of them ends up
 * with google.maps.places left undefined.
 */
export const GOOGLE_MAPS_LIBRARIES: Libraries = ["places", "drawing", "geometry"];
