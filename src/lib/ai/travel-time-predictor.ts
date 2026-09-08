/**
 * Travel-time prediction layer.
 *
 * `TravelTimePredictor` is the swap point for a trained model. Two implementations:
 *   - DemoHeuristicPredictor: clearly-labelled demo model. Applies deterministic
 *     time-of-day / weekday / traffic multipliers to the historical minutes.
 *   - RemoteHttpPredictor: calls an external Python model server (Random Forest,
 *     XGBoost…) that implements POST /predict with the contracts in ./contracts.ts.
 *
 * Neither implementation can create stops, routes or connections — they only
 * re-estimate the minutes of hops the deterministic engine already chose.
 */
import {
  predictBatchResponseSchema,
  type ModelInfo,
  type TravelTimeFeatures,
  type TravelTimePrediction,
} from "./contracts";

export interface TravelTimePredictor {
  info(): ModelInfo;
  predictBatch(instances: TravelTimeFeatures[]): Promise<TravelTimePrediction[]>;
}

const FEATURE_NAMES = [
  "route_id",
  "from_stop_id",
  "to_stop_id",
  "hour",
  "day_of_week",
  "time_bucket",
  "is_weekend",
  "distance_m",
  "historical_minutes",
  "traffic_index",
  "is_raining",
];

/* ---------------- Demo heuristic model ---------------- */

const BUCKET_FACTOR: Record<TravelTimeFeatures["time_bucket"], number> = {
  early: 0.85,
  morning_peak: 1.25,
  midday: 1.0,
  evening_peak: 1.35,
  night: 0.9,
};

export class DemoHeuristicPredictor implements TravelTimePredictor {
  info(): ModelInfo {
    return {
      name: "demo-heuristic-travel-time",
      version: "0.1-demo",
      isDemo: true,
      features: FEATURE_NAMES,
    };
  }

  predictOne(f: TravelTimeFeatures): TravelTimePrediction {
    // Demo rule set standing in for a trained regressor.
    let factor = BUCKET_FACTOR[f.time_bucket];
    if (f.is_weekend) factor *= f.time_bucket.endsWith("peak") ? 0.85 : 0.95;
    if (f.traffic_index !== null) factor *= 1 + f.traffic_index * 0.6;
    if (f.is_raining) factor *= 1.1;
    // Longer hops accumulate proportionally more delay in peak
    if (f.time_bucket.endsWith("peak") && f.distance_m > 2000) factor *= 1.05;

    // Historical minutes from travel_data may already be peak-specific; we treat the
    // "offpeak"/all-day figure as the baseline and blend to avoid double counting.
    const predicted = f.historical_minutes * factor;
    const spread = predicted * (f.time_bucket.endsWith("peak") ? 0.25 : 0.15);
    return {
      predicted_minutes: round1(predicted),
      lower_minutes: round1(Math.max(0, predicted - spread)),
      upper_minutes: round1(predicted + spread),
      confidence: f.traffic_index === null ? 0.6 : 0.75,
    };
  }

  async predictBatch(instances: TravelTimeFeatures[]) {
    return instances.map((i) => this.predictOne(i));
  }
}

/* ---------------- Remote Python model ---------------- */

export class RemoteHttpPredictor implements TravelTimePredictor {
  private modelName = "remote-ml-model";
  private modelVersion = "unknown";
  constructor(
    private baseUrl: string,
    private fallback: TravelTimePredictor = new DemoHeuristicPredictor(),
  ) {}

  info(): ModelInfo {
    return { name: this.modelName, version: this.modelVersion, isDemo: false, features: FEATURE_NAMES };
  }

  async predictBatch(instances: TravelTimeFeatures[]) {
    try {
      const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instances }),
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) throw new Error(`Model server responded ${res.status}`);
      const parsed = predictBatchResponseSchema.parse(await res.json());
      if (parsed.predictions.length !== instances.length) throw new Error("Prediction count mismatch");
      this.modelName = parsed.model.name;
      this.modelVersion = parsed.model.version;
      return parsed.predictions;
    } catch (err) {
      console.error("Remote predictor failed, using fallback:", err);
      return this.fallback.predictBatch(instances);
    }
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Chooses the predictor: remote model when ML_PREDICTOR_URL is configured, otherwise demo. */
export function getPredictor(env: { ML_PREDICTOR_URL?: string | undefined }): TravelTimePredictor {
  return env.ML_PREDICTOR_URL ? new RemoteHttpPredictor(env.ML_PREDICTOR_URL) : new DemoHeuristicPredictor();
}
