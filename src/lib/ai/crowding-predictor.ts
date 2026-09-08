/**
 * Crowding / overcrowding-risk prediction layer.
 *
 * This is the merge point for the standalone AI/ folder (predict.py +
 * overcrowding.py + bus_allocation.py), now served by ml-service/ as an HTTP
 * model — same shape as travel-time-predictor.ts:
 *   - DemoCrowdingHeuristic: clearly-labelled demo model, no Python required.
 *   - RemoteHttpCrowdingPredictor: calls ml-service/ (POST /predict) when
 *     ML_CROWDING_URL is configured, falling back to the demo model on error.
 *
 * Neither implementation can create bus legs — they only annotate the bus
 * legs the deterministic engine already chose with a predicted occupancy.
 */
import {
  predictCrowdingBatchResponseSchema,
  type CrowdingFeatures,
  type CrowdingPrediction,
  type ModelInfo,
  type RiskLevel,
} from "./contracts";

export interface CrowdingPredictor {
  info(): ModelInfo;
  predictBatch(instances: CrowdingFeatures[]): Promise<CrowdingPrediction[]>;
}

const FEATURE_NAMES = ["route_id", "hour", "weather", "is_holiday", "traffic_level", "capacity", "current_buses"];

/* ---------------- Demo heuristic model ---------------- */

// Assumed fleet defaults — the transit network dataset has no live fleet-size
// or seat-capacity fields, so a plausible constant fleet stands in (matches
// the scale of the training data in AI/transport_data_5000.csv).
export const ASSUMED_BUS_CAPACITY = 450;
export const ASSUMED_CURRENT_BUSES = 8;
const BUS_SEAT_CAPACITY = 50;

function riskLevelFor(occupancyPct: number): RiskLevel {
  if (occupancyPct < 70) return "low";
  if (occupancyPct < 90) return "medium";
  if (occupancyPct <= 100) return "high";
  return "critical";
}

/** Small stable hash so the same route always gets the same demo baseline. */
function hashRoute(routeId: string): number {
  let h = 0;
  for (let i = 0; i < routeId.length; i++) h = (h * 31 + routeId.charCodeAt(i)) >>> 0;
  return h;
}

export class DemoCrowdingHeuristic implements CrowdingPredictor {
  info(): ModelInfo {
    return { name: "demo-heuristic-crowding", version: "0.1-demo", isDemo: true, features: FEATURE_NAMES };
  }

  predictOne(f: CrowdingFeatures): CrowdingPrediction {
    // Deterministic stand-in for the trained RandomForestRegressor: a
    // per-route baseline load, shaped by rush-hour/traffic/weather/holiday
    // factors — same directional effects the real model learns.
    const routeBase = 120 + (hashRoute(f.route_id) % 220); // 120–340 riders baseline
    const peak = f.hour >= 7 && f.hour <= 9 ? 1.6 : f.hour >= 16 && f.hour <= 19 ? 1.7 : f.hour >= 10 && f.hour <= 15 ? 1.1 : 0.5;
    const traffic = f.traffic_level === "High" ? 1.25 : f.traffic_level === "Medium" ? 1.05 : 0.9;
    const weather = f.weather === "Rainy" ? 1.15 : f.weather === "Cloudy" ? 1.03 : 1;
    const holiday = f.is_holiday ? 0.7 : 1;

    const predicted = Math.round(routeBase * peak * traffic * weather * holiday);
    const occupancyPct = f.capacity ? Math.round((predicted / f.capacity) * 10000) / 100 : 0;
    const requiredBuses = predicted ? Math.ceil(predicted / BUS_SEAT_CAPACITY) : 0;

    return {
      predicted_passengers: predicted,
      capacity: f.capacity,
      occupancy_pct: occupancyPct,
      risk_level: riskLevelFor(occupancyPct),
      required_buses: requiredBuses,
      additional_buses_needed: Math.max(0, requiredBuses - f.current_buses),
    };
  }

  async predictBatch(instances: CrowdingFeatures[]) {
    return instances.map((i) => this.predictOne(i));
  }
}

/* ---------------- Remote Python model (ml-service/) ---------------- */

export class RemoteHttpCrowdingPredictor implements CrowdingPredictor {
  private modelName = "remote-crowding-model";
  private modelVersion = "unknown";
  constructor(
    private baseUrl: string,
    private fallback: CrowdingPredictor = new DemoCrowdingHeuristic(),
  ) {}

  info(): ModelInfo {
    return { name: this.modelName, version: this.modelVersion, isDemo: false, features: FEATURE_NAMES };
  }

  async predictBatch(instances: CrowdingFeatures[]) {
    if (!instances.length) return [];
    try {
      const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instances }),
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) throw new Error(`Crowding model server responded ${res.status}`);
      const parsed = predictCrowdingBatchResponseSchema.parse(await res.json());
      if (parsed.predictions.length !== instances.length) throw new Error("Prediction count mismatch");
      this.modelName = parsed.model.name;
      this.modelVersion = parsed.model.version;
      return parsed.predictions;
    } catch (err) {
      console.error("Remote crowding predictor failed, using fallback:", err);
      return this.fallback.predictBatch(instances);
    }
  }
}

/** Chooses the predictor: remote ml-service/ when ML_CROWDING_URL is configured, otherwise demo. */
export function getCrowdingPredictor(env: { ML_CROWDING_URL?: string | undefined }): CrowdingPredictor {
  return env.ML_CROWDING_URL ? new RemoteHttpCrowdingPredictor(env.ML_CROWDING_URL) : new DemoCrowdingHeuristic();
}
