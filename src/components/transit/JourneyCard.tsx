import { ArrowRight, BusFront, Clock, Coins, Footprints, Repeat } from "lucide-react";
import type { Journey } from "@/lib/transit/types";
import { CrowdingBadge } from "./CrowdingBadge";
import { cn } from "@/lib/utils";

export const ROUTE_COLOR_CLASSES = [
  "bg-route-1 text-primary-foreground",
  "bg-route-2 text-primary-foreground",
  "bg-route-3 text-primary-foreground",
  "bg-route-4 text-primary-foreground",
  "bg-route-5 text-primary-foreground",
  "bg-route-6 text-primary-foreground",
];

interface Props {
  journey: Journey;
  rank: number;
  badges: string[];
  selected: boolean;
  currency: string;
  aiScore?: number | undefined;
  predictedMinutes?: number | undefined;
  onSelect: () => void;
}

export function JourneyCard({ journey, rank, badges, selected, currency, aiScore, predictedMinutes, onSelect }: Props) {
  const buses = journey.legs.filter((l) => l.kind === "bus");
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "w-full rounded-2xl border bg-card p-4 text-left shadow-xs transition",
        selected ? "border-gold ring-3 ring-gold/30 shadow-card" : "hover:border-primary/40 hover:shadow-card",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-full font-display text-sm font-bold",
              rank === 0 ? "bg-gold text-gold-foreground" : "bg-secondary text-secondary-foreground",
            )}
          >
            {rank + 1}
          </span>
          <div className="flex flex-wrap gap-1">
            {badges.map((b) => (
              <span key={b} className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
                {b}
              </span>
            ))}
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl leading-none font-bold">
            {predictedMinutes ?? journey.totalMinutes}
            <span className="ml-0.5 text-sm font-semibold text-muted-foreground">min</span>
          </div>
          {aiScore !== undefined && (
            <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 font-mono text-[10px] font-semibold text-ink-foreground">
              AI {aiScore}
            </div>
          )}
          {predictedMinutes !== undefined && predictedMinutes !== journey.totalMinutes && (
            <div className="mt-0.5 text-[10px] text-muted-foreground">predicted · {journey.totalMinutes} min historical</div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-sm">
        <Footprints className="size-3.5 text-walk" />
        {buses.map((b, i) =>
          b.kind === "bus" ? (
            <span key={i} className="flex items-center gap-1.5">
              <span className={cn("rounded-md px-2 py-0.5 font-mono text-xs font-semibold", ROUTE_COLOR_CLASSES[b.colorIndex % 6])}>
                {b.routeNumber}
              </span>
              {b.crowding && <CrowdingBadge crowding={b.crowding} compact />}
              {i < buses.length - 1 && <ArrowRight className="size-3 text-muted-foreground" />}
            </span>
          ) : null,
        )}
        <Footprints className="size-3.5 text-walk" />
      </div>

      <p className="mt-1.5 truncate text-xs text-muted-foreground">
        {buses
          .flatMap((b, i) => (b.kind === "bus" ? [b.boardStop.name, ...(i === buses.length - 1 ? [b.alightStop.name] : [])] : []))
          .join(" → ")}
      </p>

      <dl className="mt-3 grid grid-cols-4 gap-2 border-t pt-3 text-xs">

        <Stat icon={Footprints} label="Walk" value={`${journey.walkMeters} m`} />
        <Stat icon={BusFront} label="Buses" value={String(journey.busCount)} />
        <Stat icon={Repeat} label="Transfers" value={String(journey.transferCount)} />
        <Stat icon={Coins} label="Fare" value={`${journey.fare} ${currency}`} />
      </dl>
    </button>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-muted-foreground">
        <Icon className="size-3" />
        {label}
      </dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
    </div>
  );
}
