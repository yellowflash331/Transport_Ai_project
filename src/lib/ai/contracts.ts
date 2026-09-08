/**
 * ML contracts — the data structures exchanged with the travel-time model.
 *
 * These schemas define the feature vector a future Python model (e.g. scikit-learn
 * RandomForestRegressor or XGBoost) receives and the prediction it returns.
 * Keep them in sync with the training-data export (/api/ml/training-data).
 */
import { z } from "zod";

export const TIME_BUCKETS = ["early", "morning_peak", "midday", "evening_peak", "night"] as const;
export type TimeBucket = (typeof TIME_BUCKETS)[number];

export const travelTimeFeaturesSchema = z.object({
  route_id: z.string(),
  from_stop_id: z.string(),
  to_stop_id: z.string(),
  /** 0–23 local hour (Asia/Yangon) */
  hour: z.number().int().min(0).max(23),
  /** 0 = Sunday … 6 = Saturday */
  day_of_week: z.number().int().min(0).max(6),
  time_bucket: z.enum(TIME_BUCKETS),
  is_weekend: z.boolean(),
  /** Straight-line distance between the stops in metres */
  distance_m: z.number().nonnegative(),
  /** Historical average minutes from travel_data (the engine's scheduled estimate) */
  historical_minutes: z.number().nonnegative(),
  /** Optional live traffic congestion index 0 (free-flow) – 1 (gridlock); null when unavailable */
  traffic_index: z.number().min(0).max(1).nullable(),
  /** Optional rainfall flag when weather data is available */
  is_raining: z.boolean().nullable(),
});
export type TravelTimeFeatures = z.infer<typeof travelTimeFeaturesSchema>;

export const travelTimePredictionSchema = z.object({
  predicted_minutes: z.number().nonnegative(),
  /** Lower / upper bound of the prediction interval */
  lower_minutes: z.number().nonnegative(),
  upper_minutes: z.number().nonnegative(),
  /** 0–1 */
  confidence: z.number().min(0).max(1),
});
export type TravelTimePrediction = z.infer<typeof travelTimePredictionSchema>;

/** Batch request/response shape for an external model server (POST {ML_PREDICTOR_URL}/predict). */
export const predictBatchRequestSchema = z.object({ instances: z.array(travelTimeFeaturesSchema) });
export const predictBatchResponseSchema = z.object({
  predictions: z.array(travelTimePredictionSchema),
  model: z.object({ name: z.string(), version: z.string() }),
});
export type PredictBatchRequest = z.infer<typeof predictBatchRequestSchema>;
export type PredictBatchResponse = z.infer<typeof predictBatchResponseSchema>;

export interface ModelInfo {
  name: string;
  version: string;
  /** True while running on heuristic/demo predictions instead of a trained model */
  isDemo: boolean;
  features: string[];
}

export function timeBucketForHour(hour: number): TimeBucket {
  if (hour < 6) return "early";
  if (hour < 10) return "morning_peak";
  if (hour < 16) return "midday";
  if (hour < 20) return "evening_peak";
  return "night";
}

/** Maps a time bucket to the travel_data.time_of_day labels used by the engine. */
export function timeOfDayLabel(bucket: TimeBucket): string {
  if (bucket === "morning_peak") return "morning_peak";
  if (bucket === "evening_peak") return "evening_peak";
  return "offpeak";
}

/* ---------------- Crowding / overcrowding-risk model ----------------
 * Merged from the standalone AI/ folder (predict.py + overcrowding.py +
 * bus_allocation.py) via ml-service/. Predicts passenger demand for a bus
 * route at a given time, then derives an occupancy % and risk level, plus
 * how many buses would be needed to stay under capacity.
 */

export const WEATHER_CONDITIONS = ["Clear", "Cloudy", "Rainy"] as const;
export type WeatherCondition = (typeof WEATHER_CONDITIONS)[number];

export const TRAFFIC_LEVELS = ["Low", "Medium", "High"] as const;
export type TrafficLevel = (typeof TRAFFIC_LEVELS)[number];

export const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const crowdingFeaturesSchema = z.object({
  route_id: z.string(),
  hour: z.number().int().min(0).max(23),
  weather: z.enum(WEATHER_CONDITIONS),
  is_holiday: z.boolean(),
  traffic_level: z.enum(TRAFFIC_LEVELS),
  capacity: z.number().positive(),
  current_buses: z.number().int().positive(),
});
export type CrowdingFeatures = z.infer<typeof crowdingFeaturesSchema>;

export const crowdingPredictionSchema = z.object({
  predicted_passengers: z.number().nonnegative(),
  capacity: z.number().positive(),
  occupancy_pct: z.number().nonnegative(),
  risk_level: z.enum(RISK_LEVELS),
  required_buses: z.number().int().nonnegative(),
  additional_buses_needed: z.number().int().nonnegative(),
});
export type CrowdingPrediction = z.infer<typeof crowdingPredictionSchema>;

export const predictCrowdingBatchRequestSchema = z.object({ instances: z.array(crowdingFeaturesSchema) });
export const predictCrowdingBatchResponseSchema = z.object({
  predictions: z.array(crowdingPredictionSchema),
  model: z.object({ name: z.string(), version: z.string() }),
});
export type PredictCrowdingBatchResponse = z.infer<typeof predictCrowdingBatchResponseSchema>;

/** Current local time context in Yangon. */
export function yangonNow(date = new Date()): { hour: number; dayOfWeek: number; bucket: TimeBucket; label: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Yangon",
    hour: "numeric",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "12") % 24;
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
  const bucket = timeBucketForHour(hour);
  return { hour, dayOfWeek: dayOfWeek < 0 ? 1 : dayOfWeek, bucket, label: `${wd} ${String(hour).padStart(2, "0")}:00` };
}
