"use client";
import {Input} from "@/components/ui/input";
import {ChangeEvent, MouseEvent, useEffect, useRef, useState} from "react";
import {useJsApiLoader} from "@react-google-maps/api";
import {Loading} from "@/components/shared/Loading";
import {updatePlaceToVisit} from "@/lib/client/plan";
import {Search} from "lucide-react";
import {useToast} from "@/components/ui/use-toast";
import {GOOGLE_MAPS_LIBRARIES} from "@/lib/googleMapsLibraries";

type LocationAutoCompletePropType = {
  planId: string;
  addNewPlaceToTopPlaces: (lat: number, lng: number, placeName: string) => void;
};

const LocationAutoComplete = ({planId, addNewPlaceToTopPlaces}: LocationAutoCompletePropType) => {
  const [showReults, setShowResults] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPlacePredictionsLoading, setIsPlacePredictionsLoading] = useState(false);
  const [placePredictions, setPlacePredictions] = useState<
    google.maps.places.AutocompletePrediction[]
  >([]);
  const {toast} = useToast();

  const [searchQuery, setSearchQuery] = useState("");

  // Shares the single Google Maps script load with MapProvider/Map (rendered
  // alongside this component on the same plan page) - loading a second,
  // independent script tag here, like react-google-autocomplete's own hook
  // does, races with MapProvider's and can leave google.maps.places
  // undefined depending on which one wins.
  const {isLoaded} = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!isLoaded) return;
    autocompleteService.current = new google.maps.places.AutocompleteService();
    placesService.current = new google.maps.places.PlacesService(document.createElement("div"));
  }, [isLoaded]);

  const hadleSelectItem = (e: MouseEvent<HTMLLIElement>, placeId: string) => {
    e.stopPropagation();
    setShowResults(false);
    setIsSaving(true);
    const {dismiss} = toast({
      description: `Adding the selected place!`,
    });
    placesService.current?.getDetails({placeId}, (e) => {
      const lat = e?.geometry?.location?.lat();
      const lng = e?.geometry?.location?.lng();
      if (!lat || !lng || !e?.name) return;

      updatePlaceToVisit(planId, lat, lng, e?.name).then(() => {
        setSearchQuery("");
        setIsSaving(false);
        dismiss();
        addNewPlaceToTopPlaces(lat, lng, e.name || "New Place");
      });
    });
  };

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (!value) {
      setShowResults(false);
      setPlacePredictions([]);
      return;
    }

    setShowResults(true);
    setIsPlacePredictionsLoading(true);
    debounceTimer.current = setTimeout(() => {
      autocompleteService.current?.getPlacePredictions({input: value}, (predictions) => {
        setIsPlacePredictionsLoading(false);
        setPlacePredictions(predictions ?? []);
      });
    }, 300);
  };

  return (
    <div className="relative">
      <div className="relative ">
        <Input
          disabled={isSaving}
          type="text"
          className="font-light h-12"
          placeholder="Search new location"
          onChange={handleSearch}
          value={searchQuery}
          onBlur={() => setShowResults(false)}
        />
        {isPlacePredictionsLoading ? (
          <div className="absolute right-3 top-0 h-full flex items-center">
            <Loading className="w-6 h-6" />
          </div>
        ) : (
          <div className="absolute right-3 top-0 h-full flex items-center">
            <Search className="w-4 h-4" />
          </div>
        )}
      </div>
      {showReults && (
        <div
          className="absolute w-full
        mt-2 shadow-md rounded-xl p-1 bg-background max-h-80 overflow-auto
        z-50"
          onMouseDown={(e) => e.preventDefault()}
        >
          <ul className="w-full flex flex-col gap-2" onMouseDown={(e) => e.preventDefault()}>
            {placePredictions.map((item) => (
              <li
                className="cursor-pointer
                border-b
                flex justify-between items-center
                hover:bg-muted hover:rounded-lg
                px-1 py-2 text-sm"
                onClick={(e) => hadleSelectItem(e, item.place_id)}
                key={item.place_id}
              >
                {item.description}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default LocationAutoComplete;
