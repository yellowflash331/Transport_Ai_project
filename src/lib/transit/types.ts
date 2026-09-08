/**
 * Core transit data types. These mirror the database schema 1:1 so that
 * records can be imported from Supabase tables or CSV files without mapping.
 */

export interface BusStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface BusRoute {
  id: string;
  route_number: string;
  route_name: string;
  description: string | null;
}

export interface RouteStop {
  id: string;
  route_id: string;
  stop_id: string;
  stop_sequence: number;
}

export interface TravelData {
  id: string;
  route_id: string;
  from_stop_id: string;
  to_stop_id: string;
  /** e.g. "all", "morning_peak", "evening_peak", "offpeak" */
  time_of_day: string;
  /** e.g. "all", "weekday", "weekend" */
  day_of_week: string;
  average_travel_minutes: number;
}

export interface Fare {
  id: string;
  route_id: string;
  fare: number;
}

/** A full snapshot of the network, as loaded from any data source. */
export interface TransitNetwork {
  stops: BusStop[];
  routes: BusRoute[];
  routeStops: RouteStop[];
  travelData: TravelData[];
  fares: Fare[];
  /** Human-readable label describing where the data came from. */
  source: TransitSource;
}

export interface TransitSource {
  label: string;
  isDemo: boolean;
  currency: string;
  /** Dataset credit / licence line */
  attribution?: string | undefined;
  attributionUrl?: string | undefined;
  /** Caveats shown to the user (e.g. estimated fares or travel times) */
  notes?: string[] | undefined;
}

export type Preference = "recommended" | "fastest" | "least_walking" | "fewest_transfers" | "cheapest";

export const PREFERENCES: { id: Preference; label: string; hint: string }[] = [
  { id: "recommended", label: "Recommended", hint: "Balanced time, walking and transfers" },
  { id: "fastest", label: "Fastest", hint: "Shortest total travel time" },
  { id: "least_walking", label: "Least Walking", hint: "Minimise walking distance" },
  { id: "fewest_transfers", label: "Fewest Transfers", hint: "Stay on one bus if possible" },
  { id: "cheapest", label: "Cheapest", hint: "Lowest total fare" },
];

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Place extends LatLng {
  name: string;
  /** "stop" = a bus stop from the network; "place" = a geocoded location */
  kind: "stop" | "place";
  detail?: string | undefined;
}

/* ---------- Journey output ---------- */

export interface WalkLeg {
  kind: "walk";
  from: { name: string; lat: number; lng: number };
  to: { name: string; lat: number; lng: number };
  distanceMeters: number;
  minutes: number;
}

export interface BusLeg {
  kind: "bus";
  routeId: string;
  routeNumber: string;
  routeName: string;
  boardStop: BusStop;
  alightStop: BusStop;
  /** Every stop passed, board → alight inclusive */
  stops: BusStop[];
  /** Stop-to-stop hops with the historical (travel_data) minutes used by the engine */
  hops: { fromStopId: string; toStopId: string; minutes: number; meters: number }[];
  minutes: number;
  fare: number;
  /** Colour index for map/legend */
  colorIndex: number;
  /** Predicted crowding for this bus leg, added by the AI layer (see lib/ai/crowding-predictor.ts). Absent until annotated. */
  crowding?: LegCrowding | undefined;
}

export interface LegCrowding {
  predictedPassengers: number;
  capacity: number;
  occupancyPct: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  additionalBusesNeeded: number;
  isDemo: boolean;
}

export type JourneyLeg = WalkLeg | BusLeg;

export interface Journey {
  id: string;
  legs: JourneyLeg[];
  totalMinutes: number;
  busMinutes: number;
  walkMinutes: number;
  waitMinutes: number;
  walkMeters: number;
  busCount: number;
  transferCount: number;
  fare: number;
  /** Cost under the requested preference (lower = better) */
  score: number;
  /** Human-readable, deterministic explanation. Never invents data. */
  explanation: string[];
  badges: string[];
}

export interface RouteRequest {
  origin: Place;
  destination: Place;
  preference: Preference;
  timeOfDay?: string | undefined;
  dayOfWeek?: string | undefined;
}

export interface RouteResponse {
  journeys: Journey[];
  origin: Place;
  destination: Place;
  preference: Preference;
  network: TransitNetwork["source"];
  /** Nearby stops considered at each end (for the map) */
  candidateStops: { origin: BusStop[]; destination: BusStop[] };
  computedInMs: number;
}
