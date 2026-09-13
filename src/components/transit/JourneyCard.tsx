import { ArrowRight, BusFront, Clock, Coins, Footprints, Repeat } from "lucide-react";
import type { Journey } from "@/lib/transit/types";
import { CrowdingBadge } from "./CrowdingBadge";
import { TrafficBadge } from "./TrafficBadge";
import { PrologRuleBadge } from "./PrologRuleBadge";
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
  selected: boolean;
  currency: string;
  aiScore?: number | undefined;
  predictedMinutes?: number | undefined;
  onSelect: () => void;
}

export function JourneyCard({
  journey,
  rank,
  selected,
  currency,
  aiScore,
  predictedMinutes,
  onSelect,
}: Props) {
  const buses = journey.legs.filter((l) => l.kind === "bus");
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "w-full rounded-2xl border bg-card p-5 text-left shadow-xs transition duration-200 active:scale-[0.99]",
        selected
          ? "border-gold/70 bg-gradient-to-b from-gold/[0.07] to-transparent shadow-card ring-3 ring-gold/25"
          : "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold",
              rank === 0
                ? "bg-gradient-to-br from-gold to-warning/80 text-gold-foreground shadow-sm"
                : "border bg-secondary text-secondary-foreground",
            )}
          >
            {rank + 1}
          </span>
          {journey.prologAudit && <PrologRuleBadge audit={journey.prologAudit} compact />}
        </div>
        <div className="text-right">
          <div className="font-display text-3xl leading-none font-extrabold tracking-tight">
            {predictedMinutes ?? journey.totalMinutes}
            <span className="ml-1 text-sm font-semibold text-muted-foreground">min</span>
          </div>
          <div className="mt-1.5 flex items-center justify-end gap-1.5">
            {aiScore !== undefined && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-ink-foreground">
                AI {aiScore}
              </span>
            )}
            {predictedMinutes !== undefined && predictedMinutes !== journey.totalMinutes && (
              <span className="text-[10px] text-muted-foreground">
                predicted · {journey.totalMinutes} min historical
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl border bg-muted/50 px-3 py-2.5">
        <Footprints className="size-4 shrink-0 text-walk" />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {buses.map((b, i) =>
            b.kind === "bus" ? (
              <span key={i} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "rounded-lg px-2.5 py-1 font-mono text-xs font-bold",
                    ROUTE_COLOR_CLASSES[b.colorIndex % 6],
                  )}
                >
                  {b.routeNumber}
                </span>
                {b.crowding && <CrowdingBadge crowding={b.crowding} compact />}
                {b.traffic && <TrafficBadge traffic={b.traffic} compact />}
                {i < buses.length - 1 && <ArrowRight className="size-3.5 text-muted-foreground" />}
              </span>
            ) : null,
          )}
        </div>
        <Footprints className="size-4 shrink-0 text-walk" />
      </div>

      <p className="mt-2.5 truncate px-0.5 text-xs font-medium text-muted-foreground">
        {buses
          .flatMap((b, i) =>
            b.kind === "bus"
              ? [b.boardStop.name, ...(i === buses.length - 1 ? [b.alightStop.name] : [])]
              : [],
          )
          .join(" → ")}
      </p>

      <dl className="mt-4 grid grid-cols-4 gap-2">
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
    <div className="flex flex-col-reverse items-center gap-1 rounded-xl border bg-card px-1 py-2.5 text-center">
      <dd className="font-display text-base font-bold leading-none">{value}</dd>
      <dt className="flex items-center gap-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
        <Icon className="size-3" />
        {label}
      </dt>
    </div>
  );
}
