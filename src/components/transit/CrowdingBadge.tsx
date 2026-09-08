import { Users } from "lucide-react";
import type { LegCrowding } from "@/lib/transit/types";
import { cn } from "@/lib/utils";

const RISK_STYLE: Record<LegCrowding["riskLevel"], { label: string; dot: string; text: string; bg: string }> = {
  low: { label: "Low crowding", dot: "bg-success", text: "text-success", bg: "bg-success/15" },
  medium: { label: "Medium crowding", dot: "bg-warning", text: "text-warning", bg: "bg-warning/15" },
  high: { label: "High crowding", dot: "bg-warning", text: "text-warning", bg: "bg-warning/20" },
  critical: { label: "Overcrowded", dot: "bg-destructive", text: "text-destructive", bg: "bg-destructive/15" },
};

export function CrowdingBadge({ crowding, compact }: { crowding: LegCrowding; compact?: boolean }) {
  const s = RISK_STYLE[crowding.riskLevel];
  const title = `${crowding.predictedPassengers} predicted riders / ${crowding.capacity} seats ≈ ${crowding.occupancyPct}% occupancy${
    crowding.additionalBusesNeeded > 0 ? ` · ${crowding.additionalBusesNeeded} more bus${crowding.additionalBusesNeeded > 1 ? "es" : ""} would ease it` : ""
  }${crowding.isDemo ? " (demo model)" : ""}`;

  if (compact) {
    return (
      <span title={title} className={cn("inline-flex size-2.5 shrink-0 rounded-full", s.dot)} aria-label={s.label} />
    );
  }

  return (
    <span
      title={title}
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", s.bg, s.text)}
    >
      <Users className="size-3" />
      {s.label} · {crowding.occupancyPct}%
    </span>
  );
}
