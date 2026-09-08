import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { findRoutes } from "@/lib/transit/engine";
import { getDataSource } from "@/lib/transit/data-source";
import type { BusLeg, RouteResponse } from "@/lib/transit/types";
import { recommend, type Recommendation } from "./recommender";
import { getPredictor, type TravelTimePredictor } from "./travel-time-predictor";
import { ASSUMED_BUS_CAPACITY, ASSUMED_CURRENT_BUSES, getCrowdingPredictor } from "./crowding-predictor";
import {
  timeBucketForHour,
  timeOfDayLabel,
  yangonNow,
  type CrowdingFeatures,
  type ModelInfo,
  type TimeBucket,
  type TrafficLevel,
  type TravelTimeFeatures,
} from "./contracts";

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

/** Rush hour (morning/evening peak) means heavier traffic; midday is moderate; early/night is light. */
const trafficLevelForBucket = (bucket: TimeBucket): TrafficLevel =>
  bucket.endsWith("peak") ? "High" : bucket === "midday" ? "Medium" : "Low";

/**
 * Annotates every bus leg of every journey with predicted crowding AND predicted
 * traffic congestion. Crowding comes from the standalone AI/ folder's passenger-demand
 * model (see ml-service/ and lib/ai/crowding-predictor.ts). Traffic congestion re-uses
 * the travel-time predictor's rush-hour/off-peak multipliers (see travel-time-predictor.ts)
 * to work out how many minutes a leg is predicted to lose to congestion at this time of
 * day. Neither ever changes which routes, stops or minutes the deterministic engine
 * returned — both are purely additive.
 */
async function annotateLegs(
  journeys: RouteResponse["journeys"],
  ctx: { hour: number; dayOfWeek: number; bucket: TimeBucket },
  timePredictor: TravelTimePredictor,
): Promise<{ journeys: RouteResponse["journeys"]; crowdingModel: ModelInfo }> {
  const crowdingPredictor = getCrowdingPredictor({ ML_CROWDING_URL: process.env["ML_CROWDING_URL"] });
  const trafficLevel = trafficLevelForBucket(ctx.bucket);

  // Crowding: one feature row per distinct route across all journeys (routes repeat across candidates).
  const routeIds = [...new Set(journeys.flatMap((j) => j.legs.filter((l): l is BusLeg => l.kind === "bus").map((l) => l.routeId)))];
  const crowdingFeatures: CrowdingFeatures[] = routeIds.map((route_id) => ({
    route_id,
    hour: ctx.hour,
    weather: "Clear",
    is_holiday: false,
    traffic_level: trafficLevel,
    capacity: ASSUMED_BUS_CAPACITY,
    current_buses: ASSUMED_CURRENT_BUSES,
  }));
  const crowdingPreds = routeIds.length ? await crowdingPredictor.predictBatch(crowdingFeatures) : [];
  const crowdingByRoute = new Map(routeIds.map((id, i) => [id, crowdingPreds[i]]));
  const crowdingModel = crowdingPredictor.info();

  // Traffic: one feature row per stop-to-stop hop, tagged with the (journey, leg) it belongs to,
  // so congestion can be compared against each leg's own historical minutes.
  const hopRows: { j: number; l: number; features: TravelTimeFeatures }[] = [];
  journeys.forEach((j, ji) => {
    j.legs.forEach((leg, li) => {
      if (leg.kind !== "bus") return;
      for (const hop of leg.hops) {
        hopRows.push({
          j: ji,
          l: li,
          features: {
            route_id: leg.routeId,
            from_stop_id: hop.fromStopId,
            to_stop_id: hop.toStopId,
            hour: ctx.hour,
            day_of_week: ctx.dayOfWeek,
            time_bucket: ctx.bucket,
            is_weekend: ctx.dayOfWeek === 0 || ctx.dayOfWeek === 6,
            distance_m: hop.meters,
            historical_minutes: hop.minutes,
            traffic_index: null,
            is_raining: null,
          },
        });
      }
    });
  });
  const hopPreds = hopRows.length ? await timePredictor.predictBatch(hopRows.map((r) => r.features)) : [];
  const timeModel = timePredictor.info();
  const predictedMinutesByLeg = new Map<string, number>();
  hopRows.forEach((r, i) => {
    const key = `${r.j}|${r.l}`;
    predictedMinutesByLeg.set(key, (predictedMinutesByLeg.get(key) ?? 0) + (hopPreds[i]?.predicted_minutes ?? 0));
  });

  const annotated = journeys.map((j, ji) => ({
    ...j,
    legs: j.legs.map((leg, li) => {
      if (leg.kind !== "bus") return leg;
      const crowding = crowdingByRoute.get(leg.routeId);
      const predictedMinutes = predictedMinutesByLeg.get(`${ji}|${li}`);
      const delayMinutes = predictedMinutes !== undefined ? Math.max(0, Math.round(predictedMinutes - leg.minutes)) : 0;
      return {
        ...leg,
        crowding: crowding
          ? {
              predictedPassengers: crowding.predicted_passengers,
              capacity: crowding.capacity,
              occupancyPct: crowding.occupancy_pct,
              riskLevel: crowding.risk_level,
              additionalBusesNeeded: crowding.additional_buses_needed,
              isDemo: crowdingModel.isDemo,
            }
          : leg.crowding,
        traffic: { level: trafficLevel, delayMinutes, isDemo: timeModel.isDemo },
      };
    }),
  }));

  return { journeys: annotated, crowdingModel };
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
    // Rush-hour-aware bucket (early / morning_peak / midday / evening_peak / night), used for
    // traffic congestion and the travel-time predictor. The engine only understands the coarser
    // morning_peak / evening_peak / offpeak split, derived from this one.
    const rawBucket = timeBucketForHour(hour);
    const engineBucket = timeOfDayLabel(rawBucket);

    const network = await getDataSource().loadNetwork();
    // 1. Deterministic engine (unchanged) — generates the only routes that may be shown.
    const routes = findRoutes(network, {
      origin: data.origin,
      destination: data.destination,
      preference: data.preference,
      timeOfDay: engineBucket,
      dayOfWeek: dayOfWeek === 0 || dayOfWeek === 6 ? "weekend" : "weekday",
    });

    // 2. AI layer — predicts and ranks among those valid routes only.
    const predictor = getPredictor({ ML_PREDICTOR_URL: process.env["ML_PREDICTOR_URL"] });
    const ai = await recommend({ journeys: routes.journeys, preference: data.preference, hour, dayOfWeek }, predictor);

    // 3. Crowding + traffic congestion layer — annotates bus legs only. During rush hours
    //    (morning/evening peak) legs are flagged with heavier traffic and a predicted delay
    //    on top of the historical schedule, same as the predictor already applies to the AI
    //    recommendation's predicted time.
    const { journeys: annotatedJourneys, crowdingModel } = await annotateLegs(routes.journeys, { hour, dayOfWeek, bucket: rawBucket }, predictor);

    const label = `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dayOfWeek]} ${String(hour).padStart(2, "0")}:00`;
    return { ...routes, journeys: annotatedJourneys, ai, timeContext: { hour, dayOfWeek, label }, crowdingModel };
  });
