/**
 * Intelligent route recommendation.
 *
 * Input: the VALID journeys produced by the deterministic engine (never anything else).
 * Steps:
 *   1. Re-estimate each bus hop with the travel-time predictor (time of day / weekday aware).
 *   2. Score every journey on predicted time, walking, transfers and fare, normalised
 *      across the candidate set and weighted by the user's preference.
 *   3. Return the best route, alternatives, a 0–100 score and grounded reasons.
 *
 * Every reason string is generated from numbers on the Journey object — the layer
 * cannot introduce stops, bus numbers, fares or times that the engine did not return.
 */
import type { BusLeg, Journey, Preference } from "@/lib/transit/types";
import { timeBucketForHour, type ModelInfo, type TimeBucket, type TravelTimeFeatures } from "./contracts";
import type { TravelTimePredictor } from "./travel-time-predictor";

export interface JourneyPrediction {
  journeyId: string;
  /** Sum of predicted hop minutes + walking + waiting */
  predictedTotalMinutes: number;
  predictedBusMinutes: number;
  lowerMinutes: number;
  upperMinutes: number;
  confidence: number;
  /** Difference vs the engine's historical estimate (positive = slower than schedule) */
  deltaMinutes: number;
}

export interface RankedRecommendation {
  journeyId: string;
  rank: number;
  /** 0–100, higher is better */
  score: number;
  prediction: JourneyPrediction;
  reasons: string[];
  /** Per-criterion normalised sub-scores 0–1 for the UI */
  breakdown: { time: number; walking: number; transfers: number; fare: number };
}

export interface Recommendation {
  best: RankedRecommendation | null;
  alternatives: RankedRecommendation[];
  ranked: RankedRecommendation[];
  summary: string;
  model: ModelInfo;
  context: { hour: number; dayOfWeek: number; timeBucket: TimeBucket; preference: Preference; trafficAvailable: boolean };
  weights: Record<"time" | "walking" | "transfers" | "fare", number>;
}

const PREF_WEIGHTS: Record<Preference, Recommendation["weights"]> = {
  recommended: { time: 0.45, walking: 0.2, transfers: 0.2, fare: 0.15 },
  fastest: { time: 0.7, walking: 0.1, transfers: 0.15, fare: 0.05 },
  least_walking: { time: 0.2, walking: 0.6, transfers: 0.15, fare: 0.05 },
  fewest_transfers: { time: 0.2, walking: 0.1, transfers: 0.65, fare: 0.05 },
  cheapest: { time: 0.15, walking: 0.1, transfers: 0.1, fare: 0.65 },
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface RecommendInput {
  journeys: Journey[];
  preference: Preference;
  hour: number;
  dayOfWeek: number;
  /** Optional live traffic index 0–1 (null when no traffic feed is connected) */
  trafficIndex?: number | null;
}

export async function recommend(input: RecommendInput, predictor: TravelTimePredictor): Promise<Recommendation> {
  const { journeys, preference, hour, dayOfWeek } = input;
  const bucket = timeBucketForHour(hour);
  const trafficIndex = input.trafficIndex ?? null;
  const weights = PREF_WEIGHTS[preference];
  const model = predictor.info();

  // 1. Build one feature row per bus hop, across all journeys, and predict in one batch.
  const rows: { journeyId: string; features: TravelTimeFeatures }[] = [];
  for (const j of journeys) {
    for (const leg of j.legs) {
      if (leg.kind !== "bus") continue;
      for (const hop of leg.hops) {
        rows.push({
          journeyId: j.id,
          features: {
            route_id: leg.routeId,
            from_stop_id: hop.fromStopId,
            to_stop_id: hop.toStopId,
            hour,
            day_of_week: dayOfWeek,
            time_bucket: bucket,
            is_weekend: dayOfWeek === 0 || dayOfWeek === 6,
            distance_m: hop.meters,
            historical_minutes: hop.minutes,
            traffic_index: trafficIndex,
            is_raining: null,
          },
        });
      }
    }
  }
  const preds = rows.length ? await predictor.predictBatch(rows.map((r) => r.features)) : [];

  const predictions = new Map<string, JourneyPrediction>();
  for (const j of journeys) {
    let bus = 0;
    let lo = 0;
    let hi = 0;
    let confSum = 0;
    let n = 0;
    rows.forEach((r, i) => {
      if (r.journeyId !== j.id) return;
      const p = preds[i];
      if (!p) return;
      bus += p.predicted_minutes;
      lo += p.lower_minutes;
      hi += p.upper_minutes;
      confSum += p.confidence;
      n++;
    });
    const fixed = j.walkMinutes + j.waitMinutes;
    predictions.set(j.id, {
      journeyId: j.id,
      predictedBusMinutes: Math.round(bus),
      predictedTotalMinutes: Math.round(bus + fixed),
      lowerMinutes: Math.round(lo + fixed),
      upperMinutes: Math.round(hi + fixed),
      confidence: n ? Math.round((confSum / n) * 100) / 100 : 0,
      deltaMinutes: Math.round(bus + fixed) - j.totalMinutes,
    });
  }

  // 2. Normalise criteria across candidates (1 = best in set, 0 = worst).
  const norm = (values: number[]) => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    return values.map((v) => (max === min ? 1 : 1 - (v - min) / (max - min)));
  };
  const timeN = norm(journeys.map((j) => predictions.get(j.id)!.predictedTotalMinutes));
  const walkN = norm(journeys.map((j) => j.walkMeters));
  const trN = norm(journeys.map((j) => j.transferCount));
  const fareN = norm(journeys.map((j) => j.fare));

  const scored = journeys.map((j, i) => {
    const breakdown = { time: timeN[i]!, walking: walkN[i]!, transfers: trN[i]!, fare: fareN[i]! };
    const raw = breakdown.time * weights.time + breakdown.walking * weights.walking + breakdown.transfers * weights.transfers + breakdown.fare * weights.fare;
    return { journey: j, breakdown, raw };
  });
  scored.sort((a, b) => b.raw - a.raw || a.journey.totalMinutes - b.journey.totalMinutes);

  // 3. Reasons, grounded in the journey numbers only.
  const ranked: RankedRecommendation[] = scored.map((s, rank) => {
    const p = predictions.get(s.journey.id)!;
    return {
      journeyId: s.journey.id,
      rank,
      score: Math.round(s.raw * 100),
      prediction: p,
      breakdown: s.breakdown,
      reasons: reasonsFor(s.journey, p, s.breakdown, rank, journeys.length, preference, bucket),
    };
  });

  const best = ranked[0] ?? null;
  const bestJourney = best ? journeys.find((j) => j.id === best.journeyId) : undefined;
  const summary =
    best && bestJourney
      ? `${labelOf(bestJourney)} is recommended because ${sentenceReasons(bestJourney, best.prediction)} (${DAY_NAMES[dayOfWeek]}, ${bucket.replace("_", " ")}).`
      : "No valid routes were returned by the route engine, so there is nothing to recommend.";

  return {
    best,
    alternatives: ranked.slice(1),
    ranked,
    summary,
    model,
    context: { hour, dayOfWeek, timeBucket: bucket, preference, trafficAvailable: trafficIndex !== null },
    weights,
  };
}

const labelOf = (j: Journey) => `Route ${j.id.replace("route-", "")}`;

function busNumbers(j: Journey) {
  return j.legs.filter((l): l is BusLeg => l.kind === "bus").map((l) => l.routeNumber);
}

function sentenceReasons(j: Journey, p: JourneyPrediction) {
  const parts = [`it has the lowest predicted travel time (about ${p.predictedTotalMinutes} min)`];
  parts.push(j.transferCount === 0 ? "no transfers" : j.transferCount === 1 ? "only one transfer" : `${j.transferCount} transfers`);
  parts.push(`approximately ${j.walkMeters} m of walking`);
  return `${parts[0]}, ${parts[1]}, and ${parts[2]}`;
}

function reasonsFor(
  j: Journey,
  p: JourneyPrediction,
  b: RankedRecommendation["breakdown"],
  rank: number,
  total: number,
  preference: Preference,
  bucket: TimeBucket,
): string[] {
  const r: string[] = [];
  const buses = busNumbers(j).join(" → ");
  if (b.time === 1) r.push(`Lowest predicted travel time of the ${total} valid routes: ~${p.predictedTotalMinutes} min (range ${p.lowerMinutes}–${p.upperMinutes}).`);
  else r.push(`Predicted ~${p.predictedTotalMinutes} min (range ${p.lowerMinutes}–${p.upperMinutes} min).`);
  if (p.deltaMinutes > 0) r.push(`About ${p.deltaMinutes} min slower than the historical average because of ${bucket.replace("_", " ")} conditions.`);
  else if (p.deltaMinutes < 0) r.push(`About ${-p.deltaMinutes} min faster than the historical average at this time of day.`);
  r.push(j.transferCount === 0 ? `Direct on ${buses} — no transfers.` : `${j.transferCount} transfer${j.transferCount > 1 ? "s" : ""} (${buses}).`);
  r.push(`${j.walkMeters} m of walking in total${b.walking === 1 ? " — the least of all options" : ""}.`);
  r.push(`Fare ${j.fare}${b.fare === 1 ? " — the cheapest option" : ""}.`);
  if (rank === 0 && preference !== "recommended") r.push(`Weighted for your “${preference.replace("_", " ")}” preference.`);
  if (rank > 0) {
    const weak = Object.entries(b).sort((x, y) => x[1] - y[1])[0]!;
    r.push(`Ranked #${rank + 1}: weaker on ${weak[0] === "time" ? "predicted time" : weak[0]} than the best option.`);
  }
  return r;
}
