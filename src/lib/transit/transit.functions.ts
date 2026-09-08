import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { findRoutes } from "./engine";
import { getDataSource } from "./data-source";
import { LANDMARKS } from "./landmarks";
import type { BusStop, Place, RouteResponse } from "./types";

const placeSchema = z.object({
  name: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  kind: z.enum(["stop", "place"]),
  detail: z.string().optional(),
});

const routeRequestSchema = z.object({
  origin: placeSchema,
  destination: placeSchema,
  preference: z.enum(["recommended", "fastest", "least_walking", "fewest_transfers", "cheapest"]),
  timeOfDay: z.string().optional(),
  dayOfWeek: z.string().optional(),
});

/** Deterministic route computation — runs the graph engine against the active data source. */
export const computeRoutes = createServerFn({ method: "POST" })
  .inputValidator((input) => routeRequestSchema.parse(input))
  .handler(async ({ data }): Promise<RouteResponse> => {
    const network = await getDataSource().loadNetwork();
    return findRoutes(network, data);
  });

/** All bus stops in the network — used by the "choose from map" picker. */
export const listStops = createServerFn({ method: "GET" }).handler(async (): Promise<BusStop[]> => {
  const network = await getDataSource().loadNetwork();
  return network.stops.map((s) => ({ id: s.id, name: s.name, latitude: s.latitude, longitude: s.longitude }));
});

// Yangon bounding box for geocoding
const YANGON_VIEWBOX = "96.02,16.98,96.30,16.70";

/** Location search: network stops + landmarks + OpenStreetMap (Nominatim), bounded to Yangon. */
export const searchPlaces = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ q: z.string().max(120) }).parse(input))
  .handler(async ({ data }): Promise<Place[]> => {
    const q = data.q.trim().toLowerCase();
    if (q.length < 2) return [];
    const network = await getDataSource().loadNetwork();

    const local: Place[] = [
      ...network.stops
        .filter((s) => s.name.toLowerCase().includes(q))
        .map<Place>((s) => ({ name: s.name, lat: s.latitude, lng: s.longitude, kind: "stop", detail: "Bus stop" })),
      ...LANDMARKS.filter((p) => p.name.toLowerCase().includes(q)).map<Place>((p) => ({
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        kind: "place",
        detail: p.detail,
      })),
    ];

    let remote: Place[] = [];
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", data.q);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "5");
      url.searchParams.set("viewbox", YANGON_VIEWBOX);
      url.searchParams.set("bounded", "1");
      url.searchParams.set("countrycodes", "mm");
      const res = await fetch(url, {
        headers: { "User-Agent": "TransitAI-Yangon/0.1 (route finder)", "Accept-Language": "en" },
        signal: AbortSignal.timeout(3500),
      });
      if (res.ok) {
        const rows = (await res.json()) as { display_name: string; lat: string; lon: string; name?: string; type?: string }[];
        remote = rows.map((r) => {
          const parts = r.display_name.split(",").map((s) => s.trim());
          return {
            name: r.name || parts[0] || r.display_name,
            detail: parts.slice(1, 3).join(", ") || "OpenStreetMap",
            lat: Number(r.lat),
            lng: Number(r.lon),
            kind: "place" as const,
          };
        });
      }
    } catch {
      // Geocoder unavailable — local results still work.
    }

    const seen = new Set<string>();
    return [...local, ...remote]
      .filter((p) => {
        const k = `${p.name.toLowerCase()}|${p.lat.toFixed(3)}|${p.lng.toFixed(3)}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 8);
  });
