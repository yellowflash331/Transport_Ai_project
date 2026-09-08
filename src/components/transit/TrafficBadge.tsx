import { TrafficCone } from "lucide-react";
import type { LegTraffic } from "@/lib/transit/types";
import { cn } from "@/lib/utils";

const LEVEL_STYLE: Record<LegTraffic["level"], { label: string; dot: string; text: string; bg: string }> = {
  Low: { label: "Light traffic", dot: "bg-success", text: "text-success", bg: "bg-success/15" },
  Medium: { label: "Moderate traffic", dot: "bg-warning", text: "text-warning", bg: "bg-warning/15" },
  High: { label: "Heavy traffic", dot: "bg-destructive", text: "text-destructive", bg: "bg-destructive/15" },
};

export function TrafficBadge({ traffic, compact }: { traffic: LegTraffic; compact?: boolean }) {
  const s = LEVEL_STYLE[traffic.level];
  const title = `${s.label}${traffic.delayMinutes > 0 ? ` · about +${traffic.delayMinutes} min vs free-flow` : ""}${traffic.isDemo ? " (demo model)" : ""}`;

  if (compact) {
    return <span title={title} className={cn("inline-flex size-2.5 shrink-0 rounded-full", s.dot)} aria-label={s.label} />;
  }

  return (
    <span title={title} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", s.bg, s.text)}>
      <TrafficCone className="size-3" />
      {s.label}
      {traffic.delayMinutes > 0 ? ` · +${traffic.delayMinutes} min` : ""}
    </span>
  );
}
