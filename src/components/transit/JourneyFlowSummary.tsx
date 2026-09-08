import { ArrowRight, Footprints, MapPin } from "lucide-react";
import type { Journey } from "@/lib/transit/types";
import { ROUTE_COLOR_CLASSES } from "./JourneyCard";
import { CrowdingBadge } from "./CrowdingBadge";
import { cn } from "@/lib/utils";

/**
 * The at-a-glance version of a journey: place → walk → bus stop → route →
 * bus stop → walk → place, with walking distances called out. Bus stops are
 * picked automatically by the route engine (lib/transit/engine.ts
 * nearbyStops) — the user only ever chooses places.
 */
export function JourneyFlowSummary({ journey }: { journey: Journey }) {
  const items = journey.legs.flatMap((leg, i) => {
    const sep = <ArrowRight key={`sep-${i}`} className="size-3.5 shrink-0 text-muted-foreground/50" />;
    if (leg.kind === "walk") {
      return [
        sep,
        <span
          key={`walk-${i}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-walk/50 bg-walk/10 px-2.5 py-1 text-xs font-semibold text-walk"
        >
          <Footprints className="size-3.5" /> {leg.distanceMeters} m
        </span>,
      ];
    }
    return [
      sep,
      <span key={`bus-${i}`} className="inline-flex shrink-0 items-center gap-1.5">
        <span className={cn("rounded-md px-2 py-1 font-mono text-xs font-bold", ROUTE_COLOR_CLASSES[leg.colorIndex % 6])}>
          {leg.routeNumber}
        </span>
        {leg.crowding && <CrowdingBadge crowding={leg.crowding} compact />}
      </span>,
    ];
  });

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border bg-muted/40 px-3 py-2.5 text-xs">
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success px-2.5 py-1 font-semibold text-primary-foreground">
        <MapPin className="size-3.5" /> {truncate(firstLabel(journey))}
      </span>
      {items}
      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/50" />
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-route-1 px-2.5 py-1 font-semibold text-primary-foreground">
        <MapPin className="size-3.5" /> {truncate(lastLabel(journey))}
      </span>
    </div>
  );
}

function truncate(s: string) {
  return s.length > 22 ? `${s.slice(0, 21)}…` : s;
}

function firstLabel(j: Journey) {
  const l = j.legs[0];
  return l?.kind === "walk" ? l.from.name : (l?.boardStop.name ?? "");
}

function lastLabel(j: Journey) {
  const l = j.legs[j.legs.length - 1];
  return l?.kind === "walk" ? l.to.name : (l?.alightStop.name ?? "");
}
