/**
 * Explanation layer ("Why this route?").
 *
 * This is the pluggable AI boundary. The default explainer is a deterministic
 * template that only restates facts already computed by the route engine.
 * An LLM-backed explainer can be swapped in via `setExplainer`, but it must
 * receive the finished Journey and may only rephrase — never invent bus
 * numbers, stops, fares or connections.
 */
import type { Journey, Preference } from "./types";

export type Explainer = (journey: Journey, preference: Preference, alternatives?: Journey[]) => string[];

const PREF_LABEL: Record<Preference, string> = {
  recommended: "a balance of time, walking and transfers",
  fastest: "the shortest total travel time",
  least_walking: "the least walking",
  fewest_transfers: "the fewest bus changes",
  cheapest: "the lowest fare",
};

export const templateExplainer: Explainer = (j, preference, alternatives = []) => {
  const lines: string[] = [];
  const buses = j.legs.filter((l) => l.kind === "bus");
  const busNumbers = buses.map((b) => (b.kind === "bus" ? b.routeNumber : "")).join(" → ");

  lines.push(`Ranked for ${PREF_LABEL[preference]}.`);

  if (j.transferCount === 0) {
    lines.push(`A single bus (${busNumbers}) covers the whole trip — no transfers needed.`);
  } else {
    lines.push(`Uses ${j.busCount} buses (${busNumbers}) with ${j.transferCount} transfer${j.transferCount > 1 ? "s" : ""}.`);
  }

  lines.push(
    `About ${j.totalMinutes} min door to door: ${j.busMinutes} min on the bus, ${j.walkMinutes} min walking (${j.walkMeters} m) and ~${j.waitMinutes} min waiting.`,
  );

  const others = alternatives.filter((a) => a.id !== j.id);
  if (others.length) {
    const fastest = Math.min(...others.map((o) => o.totalMinutes));
    const leastWalk = Math.min(...others.map((o) => o.walkMeters));
    const cheapest = Math.min(...others.map((o) => o.fare));
    const fewest = Math.min(...others.map((o) => o.transferCount));
    if (j.totalMinutes <= fastest) lines.push("It is the quickest of the options shown.");
    else lines.push(`It is ${j.totalMinutes - fastest} min slower than the quickest option.`);
    if (j.walkMeters <= leastWalk) lines.push("It also has the least walking.");
    if (j.fare <= cheapest && j.fare < Math.max(...others.map((o) => o.fare))) lines.push("It is the cheapest option.");
    if (j.transferCount <= fewest && j.transferCount < Math.max(...others.map((o) => o.transferCount)))
      lines.push("It has the fewest transfers.");
  }

  lines.push("Times are estimates from recorded average travel data; fares are per boarding.");
  return lines;
};

let activeExplainer: Explainer = templateExplainer;

export function setExplainer(e: Explainer) {
  activeExplainer = e;
}

export function explainJourney(journey: Journey, preference: Preference, alternatives?: Journey[]) {
  return activeExplainer(journey, preference, alternatives);
}
