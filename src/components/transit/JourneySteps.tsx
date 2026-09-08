import { BusFront, Flag, Footprints, MapPin, Sparkles } from "lucide-react";
import type { Journey } from "@/lib/transit/types";
import { ROUTE_COLOR_CLASSES } from "./JourneyCard";
import { CrowdingBadge } from "./CrowdingBadge";
import { cn } from "@/lib/utils";

export function JourneySteps({ journey, currency }: { journey: Journey; currency: string }) {
  return (
    <div className="space-y-6">
      <ol className="relative space-y-0">
        <Step icon={<MapPin className="size-4" />} tone="start" title="START" subtitle={firstName(journey)} />
        {journey.legs.map((leg, i) => {
          if (leg.kind === "walk") {
            return (
              <Step
                key={i}
                icon={<Footprints className="size-4" />}
                tone="walk"
                title={`Walk ${leg.distanceMeters} m`}
                subtitle={`≈ ${Math.max(1, Math.round(leg.minutes))} min to ${leg.to.name}`}
              />
            );
          }
          const middle = leg.stops.length - 2;
          return (
            <li key={i} className="relative pb-6 pl-10 last:pb-0">
              <span className={cn("absolute top-0 left-0 flex size-7 items-center justify-center rounded-full", ROUTE_COLOR_CLASSES[leg.colorIndex % 6])}>
                <BusFront className="size-4" />
              </span>
              <span className="absolute top-7 bottom-0 left-[13px] w-0.5 bg-border" />
              <div className="font-semibold">
                Board <span className={cn("rounded-md px-1.5 py-0.5 font-mono text-xs", ROUTE_COLOR_CLASSES[leg.colorIndex % 6])}>{leg.routeNumber}</span>{" "}
                at {leg.boardStop.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {leg.routeName} · {Math.round(leg.minutes)} min · {leg.fare} {currency}
              </div>
              {leg.crowding && (
                <div className="mt-1.5">
                  <CrowdingBadge crowding={leg.crowding} />
                </div>
              )}
              {middle > 0 && (
                <details className="mt-1.5 text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none hover:text-foreground">
                    {middle} stop{middle > 1 ? "s" : ""} in between
                  </summary>
                  <ul className="mt-1 ml-1 space-y-0.5 border-l pl-3">
                    {leg.stops.slice(1, -1).map((s) => (
                      <li key={s.id}>{s.name}</li>
                    ))}
                  </ul>
                </details>
              )}
              <div className="mt-2 font-semibold">Get off at {leg.alightStop.name}</div>
            </li>
          );
        })}
        <Step icon={<Flag className="size-4" />} tone="end" title="DESTINATION" subtitle={lastName(journey)} last />
      </ol>

      <div className="rounded-xl border border-gold/40 bg-accent/60 p-4">
        <div className="flex items-center gap-2 font-display text-sm font-bold">
          <Sparkles className="size-4 text-gold-foreground" /> Why this route?
        </div>
        <ul className="mt-2 space-y-1 text-sm text-foreground/90">
          {journey.explanation.map((line, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-gold-foreground/60">•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function firstName(j: Journey) {
  const l = j.legs[0];
  return l?.kind === "walk" ? l.from.name : (l?.boardStop.name ?? "");
}

function lastName(j: Journey) {
  const l = j.legs[j.legs.length - 1];
  return l?.kind === "walk" ? l.to.name : (l?.alightStop.name ?? "");
}

function Step({
  icon,
  tone,
  title,
  subtitle,
  last,
}: {
  icon: React.ReactNode;
  tone: "start" | "walk" | "end";
  title: string;
  subtitle?: string;
  last?: boolean;
}) {
  return (
    <li className="relative pb-6 pl-10 last:pb-0">
      <span
        className={cn(
          "absolute top-0 left-0 flex size-7 items-center justify-center rounded-full",
          tone === "start" && "bg-success text-primary-foreground",
          tone === "end" && "bg-route-1 text-primary-foreground",
          tone === "walk" && "border-2 border-dashed border-walk bg-card text-walk",
        )}
      >
        {icon}
      </span>
      {!last && <span className="absolute top-7 bottom-0 left-[13px] w-0.5 border-l-2 border-dashed border-border" />}
      <div className={cn("font-semibold", tone !== "walk" && "font-display tracking-wide")}>{title}</div>
      {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
    </li>
  );
}
