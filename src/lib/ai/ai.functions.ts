import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { findRoutes } from "@/lib/transit/engine";
import { getDataSource } from "@/lib/transit/data-source";
import type { BusLeg, RouteResponse } from "@/lib/transit/types";
import { recommend, type Recommendation } from "./recommender";
import { getPredictor } from "./travel-time-predictor";
import { ASSUMED_BUS_CAPACITY, ASSUMED_CURRENT_BUSES, getCrowdingPredictor } from "./crowding-predictor";
import { timeOfDayLabel, yangonNow, type CrowdingFeatures, type ModelInfo, type TrafficLevel } from "./contracts";

const placeSchema = z.object({
  name: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  kind: z.enum(["stop", "place"]),
  detail: z.string().optional(),
});

const planSchema = z.object({
  origin: placeSchema,
  destination: placeSchema,
  preference: z.enum(["recommended", "fastest", "least_walking", "fewest_transfers", "cheapest"]),
  /** Optional override of departure hour (0–23) and weekday (0–6); defaults to now in Yangon */
  hour: z.number().int().min(0).max(23).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
});

export interface PlanResponse extends RouteResponse {
  ai: Recommendation;
  timeContext: { hour: number; dayOfWeek: number; label: string };
  crowdingModel: ModelInfo;
}

const trafficLevelForBucket = (bucket: string): TrafficLevel =>
  bucket.endsWith("peak") ? "High" : bucket === "midday" ? "Medium" : "Low";

/**
 * Annotates every bus leg of every journey with a predicted crowding level.
 * Merged from the standalone AI/ folder's passenger-demand model (see
 * ml-service/ and lib/ai/crowding-predictor.ts). Never changes which routes,
 * stops or minutes the deterministic engine returned — purely additive.
 */
async function annotateCrowding(
  journeys: RouteResponse["journeys"],
  ctx: { hour: number; dayOfWeek: number; bucket: string },
): Promise<{ journeys: RouteResponse["journeys"]; model: ModelInfo }> {
  const predictor = getCrowdingPredictor({ ML_CROWDING_URL: process.env["ML_CROWDING_URL"] });
  const trafficLevel = trafficLevelForBucket(ctx.bucket);

  // One feature row per distinct route across all journeys (routes repeat across candidates).
  const routeIds = [...new Set(journeys.flatMap((j) => j.legs.filter((l): l is BusLeg => l.kind === "bus").map((l) => l.routeId)))];
  const features: CrowdingFeatures[] = routeIds.map((route_id) => ({
    route_id,
    hour: ctx.hour,
    weather: "Clear",
    is_holiday: false,
    traffic_level: trafficLevel,
    capacity: ASSUMED_BUS_CAPACITY,
    current_buses: ASSUMED_CURRENT_BUSES,
  }));
  const predictions = routeIds.length ? await predictor.predictBatch(features) : [];
  const byRoute = new Map(routeIds.map((id, i) => [id, predictions[i]]));
  const model = predictor.info();

  const annotated = journeys.map((j) => ({
    ...j,
    legs: j.legs.map((leg) => {
      if (leg.kind !== "bus") return leg;
      const p = byRoute.get(leg.routeId);
      if (!p) return leg;
      return {
        ...leg,
        crowding: {
          predictedPassengers: p.predicted_passengers,
          capacity: p.capacity,
          occupancyPct: p.occupancy_pct,
          riskLevel: p.risk_level,
          additionalBusesNeeded: p.additional_buses_needed,
          isDemo: model.isDemo,
        },
      };
    }),
  }));

  return { journeys: annotated, model };
}

/**
 * Full pipeline: deterministic engine → valid routes → AI predictor + recommender.
 * The AI stage only re-orders and annotates the engine's output.
 */
export const planJourney = createServerFn({ method: "POST" })
  .inputValidator((input) => planSchema.parse(input))
  .handler(async ({ data }): Promise<PlanResponse> => {
    const now = yangonNow();
    const hour = data.hour ?? now.hour;
    const dayOfWeek = data.dayOfWeek ?? now.dayOfWeek;
    const bucket = timeOfDayLabel(
      hour < 6 ? "early" : hour < 10 ? "morning_peak" : hour < 16 ? "midday" : hour < 20 ? "evening_peak" : "night",
    );

    const network = await getDataSource().loadNetwork();
    // 1. Deterministic engine (unchanged) — generates the only routes that may be shown.
    const routes = findRoutes(network, {
      origin: data.origin,
      destination: data.destination,
      preference: data.preference,
      timeOfDay: bucket,
      dayOfWeek: dayOfWeek === 0 || dayOfWeek === 6 ? "weekend" : "weekday",
    });

    // 2. AI layer — predicts and ranks among those valid routes only.
    const predictor = getPredictor({ ML_PREDICTOR_URL: process.env["ML_PREDICTOR_URL"] });
    const ai = await recommend({ journeys: routes.journeys, preference: data.preference, hour, dayOfWeek }, predictor);

    // 3. Crowding layer (merged AI/ passenger-demand model) — annotates bus legs only.
    const { journeys: crowdedJourneys, model: crowdingModel } = await annotateCrowding(routes.journeys, { hour, dayOfWeek, bucket });

    const label = `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dayOfWeek]} ${String(hour).padStart(2, "0")}:00`;
    return { ...routes, journeys: crowdedJourneys, ai, timeContext: { hour, dayOfWeek, label }, crowdingModel };
  });
