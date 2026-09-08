import { Database, FlaskConical } from "lucide-react";
import type { TransitSource } from "@/lib/transit/types";

const YBS_DEFAULT: TransitSource = {
  label: "Yangon Bus Service (YBS) open data",
  isDemo: false,
  currency: "MMK",
  attribution: "YBS Data (thantthet & contributors), based on YRTA open data · CC BY-SA 4.0",
  attributionUrl: "https://github.com/thantthet/YBS-Data",
  notes: ["Fares assume the standard 200 MMK flat fare per bus.", "Travel times are estimated from stop-to-stop distance."],
};

/** Shows where the bus network comes from and what is estimated. */
export function DemoBanner({ source = YBS_DEFAULT }: { source?: TransitSource }) {
  if (source.isDemo) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
        <FlaskConical className="size-3.5 shrink-0 text-warning" />
        <span>
          <strong className="font-semibold">Demo data.</strong> Routes, stops, times and fares shown are fictional — not real Yangon
          bus service.
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-xs text-foreground">
      <Database className="mt-0.5 size-3.5 shrink-0 text-primary" />
      <span>
        <strong className="font-semibold">{source.label}.</strong>{" "}
        {source.attributionUrl ? (
          <a href={source.attributionUrl} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2">
            {source.attribution}
          </a>
        ) : (
          source.attribution
        )}
        {source.notes?.length ? <span className="text-muted-foreground"> {source.notes.join(" ")}</span> : null}
      </span>
    </div>
  );
}
