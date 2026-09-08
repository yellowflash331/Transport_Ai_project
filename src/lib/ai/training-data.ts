/**
 * Training-data export for the ML pipeline.
 * Converts travel_data records (+ stop geometry) into the feature schema defined in
 * ./contracts.ts so a Python notebook can train a regressor directly from the CSV.
 */
import type { TransitNetwork } from "@/lib/transit/types";
import { haversineMeters } from "@/lib/transit/geo";
import { TIME_BUCKETS, type TravelTimeFeatures } from "./contracts";

export interface TrainingRow extends TravelTimeFeatures {
  /** Target variable */
  actual_minutes: number;
}

const REPRESENTATIVE_HOUR: Record<string, number> = {
  early: 5,
  morning_peak: 8,
  midday: 13,
  evening_peak: 18,
  night: 21,
  offpeak: 13,
  all: 12,
};

export function buildTrainingRows(network: TransitNetwork): TrainingRow[] {
  const stops = new Map(network.stops.map((s) => [s.id, s]));
  const rows: TrainingRow[] = [];
  for (const t of network.travelData) {
    const a = stops.get(t.from_stop_id);
    const b = stops.get(t.to_stop_id);
    if (!a || !b) continue;
    const hour = REPRESENTATIVE_HOUR[t.time_of_day] ?? 12;
    const bucket = (TIME_BUCKETS as readonly string[]).includes(t.time_of_day)
      ? (t.time_of_day as TravelTimeFeatures["time_bucket"])
      : t.time_of_day === "morning_peak"
        ? "morning_peak"
        : t.time_of_day === "evening_peak"
          ? "evening_peak"
          : "midday";
    const days = t.day_of_week === "weekend" ? [0, 6] : t.day_of_week === "weekday" ? [1, 2, 3, 4, 5] : [1, 6];
    for (const d of days) {
      rows.push({
        route_id: t.route_id,
        from_stop_id: t.from_stop_id,
        to_stop_id: t.to_stop_id,
        hour,
        day_of_week: d,
        time_bucket: bucket,
        is_weekend: d === 0 || d === 6,
        distance_m: Math.round(haversineMeters({ lat: a.latitude, lng: a.longitude }, { lat: b.latitude, lng: b.longitude })),
        historical_minutes: t.average_travel_minutes,
        traffic_index: null,
        is_raining: null,
        actual_minutes: t.average_travel_minutes,
      });
    }
  }
  return rows;
}

export function trainingRowsToCsv(rows: TrainingRow[]): string {
  const cols: (keyof TrainingRow)[] = [
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
    "actual_minutes",
  ];
  const esc = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
