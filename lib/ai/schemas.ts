export const candidatePoiSchema = {
    type: "object",
    properties: {
        candidates: {
            type: "array",
            description: "20 to 30 candidate points of interest for the destination, covering a mix of categories so a downstream filter can narrow them down",
            items: {
                type: "object",
                properties: {
                    name: { type: "string", description: "Name of the point of interest" },
                    category: { type: "string", description: "One of: sightseeing, adventure, culturalexperiences, historical, relaxationwellness, shopping, nightlife" },
                    weatherAlign: { type: "string", description: "One of: indoor, outdoor, all - whether this activity is viable in bad weather" },
                    openTime: { type: "string", description: "Typical opening time, 24h HH:mm format, e.g. 09:00" },
                    closeTime: { type: "string", description: "Typical closing time, 24h HH:mm format, e.g. 18:00" },
                    cost: { type: "number", description: "Approximate cost per person to visit, in the local currency, 0 if free" },
                    coordinates: {
                        type: "object",
                        properties: {
                            lat: { type: "number", description: "Latitude" },
                            lng: { type: "number", description: "Longitude" },
                        },
                        required: ["lat", "lng"],
                    },
                },
                required: ["name", "category", "weatherAlign", "openTime", "closeTime", "cost", "coordinates"],
            },
        },
    },
    "required": ["candidates"],
};

export const batch1Schema = {
    type: "object",
    properties: {
        abouttheplace: {
            type: "string",
            description: "about the place in atleast 50 words",
        },
        besttimetovisit: {
            type: "string",
            description: "Best time to visit",
        },

    },
    "required": [
        "abouttheplace",
        "besttimetovisit"
    ],
};

export const batch2Schema = {
    type: "object",
    properties: {
        adventuresactivitiestodo: {
            type: "array",
            description: "Top adventures activities, atleast 5, like trekking, water sports, specify the place also",
            items: { type: "string" },
        },
        localcuisinerecommendations: {
            type: "array",
            description: "Local Cuisine Recommendations",
            items: { type: "string" },
        },
        packingchecklist: {
            type: "array",
            description: "Packing Checklist",
            items: { type: "string" },
        },
    },
    "required": [
        "adventuresactivitiestodo",
        "localcuisinerecommendations",
        "packingchecklist"
    ],
};

const itineraryActivityItemSchema = {
    type: "object",
    properties: {
        itineraryItem: { type: "string", description: "About the itinerary item" },
        briefDescription: { type: "string", description: "Elaborate about the place suggested" },
        contextualReasoning: { type: "string", description: "One sentence explaining exactly why this activity suits the traveller's stated profile (activity preferences, companion, pace, budget) and the immediate environment (the current weather given in the prompt)" },
        coordinates: {
            type: "object",
            description: "Coordinates of this specific activity/place",
            properties: {
                lat: { type: "number", description: "Latitude" },
                lng: { type: "number", description: "Longitude" },
            },
            required: ["lat", "lng"],
        },
        weatherAlign: { type: "string", description: "One of: indoor, outdoor, all - whether this specific activity is viable in bad weather (rain/snow)" },
    },
    required: ["itineraryItem", "briefDescription", "contextualReasoning", "coordinates", "weatherAlign"],
};

// Itinerary is generated in small day-range chunks (see lib/server/generatePlanContent.ts's
// generateItineraryDays) rather than one call for the whole trip - each activity now carries
// coordinates + contextualReasoning, so a single call covering every day of a long trip risks
// exceeding the local model's response time before the Cloudflare tunnel's ~100s edge timeout.
export const itineraryChunkSchema = {
    type: "object",
    properties: {
        itinerary: {
            type: "array",
            description: "Itinerary for the requested day range only, in array format",
            items: {
                type: "object",
                properties: {
                    title: { type: "string", description: "Day title" },
                    activities: {
                        type: "object",
                        properties: {
                            morning: {
                                type: "array",
                                items: itineraryActivityItemSchema,
                            },
                            afternoon: {
                                type: "array",
                                items: itineraryActivityItemSchema,
                            },
                            evening: {
                                type: "array",
                                items: itineraryActivityItemSchema,
                            },
                        },
                        required: ["morning", "afternoon", "evening"],
                    },
                },
                required: ["title", "activities"],
            },
        },
    },
    "required": ["itinerary"],
};

// Fallback only, used when the recommendation engine's filtered/ranked POI
// list isn't available to derive Top Places to Visit from directly.
export const topPlacesSchema = {
    type: "object",
    properties: {
        topplacestovisit: {
            type: "array",
            description: "Top places to visit along with their coordinates, atelast top 5, can be more",
            items: {
                type: "object",
                properties: {
                    name: { type: "string", description: "Name of the place" },
                    coordinates: {
                        type: "object",
                        properties: {
                            lat: { type: "number", description: "Latitude" },
                            lng: { type: "number", description: "Longitude" },
                        },
                        required: ["lat", "lng"],
                    },
                },
                required: ["name", "coordinates"],
            },
        },
    },
    "required": ["topplacestovisit"],
};