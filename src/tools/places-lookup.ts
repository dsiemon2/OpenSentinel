/**
 * Places/Location Lookup Tool
 *
 * Search for places, geocode addresses, find nearby POIs, and get directions.
 * Uses OpenStreetMap Nominatim (geocoding), Overpass API (POI search), and OSRM (routing).
 * All APIs are free and require no API key.
 */

const USER_AGENT = "OpenSentinel/2.7 (https://opensentinel.ai)";

let lastNominatimCall = 0;

async function nominatimThrottle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastNominatimCall;
  if (elapsed < 1100) {
    await new Promise((r) => setTimeout(r, 1100 - elapsed));
  }
  lastNominatimCall = Date.now();
}

export interface PlaceResult {
  name: string;
  displayName: string;
  lat: number;
  lon: number;
  type: string;
  category: string;
  address: Record<string, string>;
  osmId: string;
  distance?: number;
}

export interface DirectionsResult {
  distance: number;
  duration: number;
  distanceText: string;
  durationText: string;
  steps: DirectionStep[];
  geometry?: string;
}

export interface DirectionStep {
  instruction: string;
  distance: number;
  duration: number;
  name: string;
}

/**
 * Search for places by name or address using Nominatim
 */
export async function searchPlaces(query: string, limit = 10): Promise<PlaceResult[]> {
  if (!query || query.trim().length === 0) return [];
  await nominatimThrottle();

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(Math.min(limit, 50)));
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) throw new Error(`Nominatim error: ${response.status}`);
  const data = await response.json();

  return (data as any[]).map((item) => ({
    name: item.name || item.display_name?.split(",")[0] || "",
    displayName: item.display_name || "",
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
    type: item.type || "",
    category: item.category || item.class || "",
    address: item.address || {},
    osmId: `${item.osm_type?.[0] || ""}${item.osm_id || ""}`,
  }));
}

/**
 * Reverse geocode: coordinates to address
 */
export async function reverseGeocode(lat: number, lon: number): Promise<PlaceResult | null> {
  if (!isValidLat(lat) || !isValidLon(lon)) {
    throw new Error("Invalid coordinates: lat must be -90..90, lon must be -180..180");
  }

  await nominatimThrottle();

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) throw new Error(`Nominatim reverse error: ${response.status}`);
  const item = await response.json();

  if (item.error) return null;

  return {
    name: item.name || item.display_name?.split(",")[0] || "",
    displayName: item.display_name || "",
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
    type: item.type || "",
    category: item.category || item.class || "",
    address: item.address || {},
    osmId: `${item.osm_type?.[0] || ""}${item.osm_id || ""}`,
  };
}

/**
 * Find nearby points of interest using Overpass API
 */
export async function findNearby(
  lat: number,
  lon: number,
  category = "any",
  radius = 1000,
  limit = 10
): Promise<PlaceResult[]> {
  if (!isValidLat(lat) || !isValidLon(lon)) {
    throw new Error("Invalid coordinates: lat must be -90..90, lon must be -180..180");
  }

  const clampedRadius = Math.min(Math.max(100, radius), 50000);

  const amenityMap: Record<string, string> = {
    restaurant: "restaurant",
    hotel: "hotel",
    cafe: "cafe",
    hospital: "hospital",
    pharmacy: "pharmacy",
    gas_station: "fuel",
    parking: "parking",
    atm: "atm",
    supermarket: "supermarket",
    school: "school",
  };

  let overpassFilter: string;
  if (category === "any" || !amenityMap[category]) {
    overpassFilter = `node(around:${clampedRadius},${lat},${lon})["amenity"];`;
  } else {
    overpassFilter = `node(around:${clampedRadius},${lat},${lon})["amenity"="${amenityMap[category]}"];`;
  }

  const query = `[out:json][timeout:10];${overpassFilter}out body ${Math.min(limit, 50)};`;

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) throw new Error(`Overpass API error: ${response.status}`);
  const data = await response.json();

  const results: PlaceResult[] = (data.elements || []).map((el: any) => {
    const dist = haversineDistance(lat, lon, el.lat, el.lon);
    return {
      name: el.tags?.name || el.tags?.amenity || "Unknown",
      displayName: [el.tags?.name, el.tags?.["addr:street"], el.tags?.["addr:city"]].filter(Boolean).join(", "),
      lat: el.lat,
      lon: el.lon,
      type: el.tags?.amenity || "",
      category: "amenity",
      address: {
        street: el.tags?.["addr:street"] || "",
        housenumber: el.tags?.["addr:housenumber"] || "",
        city: el.tags?.["addr:city"] || "",
        postcode: el.tags?.["addr:postcode"] || "",
      },
      osmId: `n${el.id}`,
      distance: Math.round(dist),
    };
  });

  return results.sort((a, b) => (a.distance || 0) - (b.distance || 0));
}

/**
 * Get driving directions using OSRM
 */
export async function getDirections(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number
): Promise<DirectionsResult> {
  if (!isValidLat(fromLat) || !isValidLon(fromLon) || !isValidLat(toLat) || !isValidLon(toLon)) {
    throw new Error("Invalid coordinates");
  }

  const url = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&steps=true`;

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) throw new Error(`OSRM error: ${response.status}`);
  const data = await response.json();

  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error(`No route found: ${data.code}`);
  }

  const route = data.routes[0];
  const legs = route.legs || [];

  const steps: DirectionStep[] = [];
  for (const leg of legs) {
    for (const step of leg.steps || []) {
      steps.push({
        instruction: step.maneuver?.modifier
          ? `${step.maneuver.type} ${step.maneuver.modifier}`.trim()
          : step.maneuver?.type || "continue",
        distance: step.distance || 0,
        duration: step.duration || 0,
        name: step.name || "",
      });
    }
  }

  const totalDistance = route.distance || 0;
  const totalDuration = route.duration || 0;

  return {
    distance: totalDistance,
    duration: totalDuration,
    distanceText: formatDistance(totalDistance),
    durationText: formatDuration(totalDuration),
    steps,
    geometry: route.geometry,
  };
}

// --- Helpers ---

function isValidLat(lat: number): boolean {
  return typeof lat === "number" && !isNaN(lat) && lat >= -90 && lat <= 90;
}

function isValidLon(lon: number): boolean {
  return typeof lon === "number" && !isNaN(lon) && lon >= -180 && lon <= 180;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return `${hours}h ${mins}min`;
}
