import { lazy, Suspense, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BusFront, Check, Loader2, X } from "lucide-react";
import { listStops } from "@/lib/transit/transit.functions";
import type { BusStop, Place } from "@/lib/transit/types";
import { cn } from "@/lib/utils";

const StopPickerMap = lazy(() => import("./StopPickerMap"));

interface Props {
  open: boolean;
  title: string;
  accent: string;
  onClose: () => void;
  onPick: (p: Place) => void;
}

export function StopPickerDialog({ open, title, accent, onClose, onPick }: Props) {
  const fetchStops = useServerFn(listStops);
  const { data: stops, isLoading } = useQuery({ queryKey: ["stops"], queryFn: () => fetchStops(), staleTime: Infinity, enabled: open });
  const [selected, setSelected] = useState<BusStop | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-ink/60 p-3 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border bg-card shadow-float animate-rise"
      >
        <header className="flex items-center gap-3 border-b px-4 py-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BusFront className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-bold">{title}</h2>
            <p className="text-xs text-muted-foreground">
              Optional — most people just type a place instead. Tap a bus stop marker to pin an exact one.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 hover:bg-accent">
            <X className="size-4" />
          </button>
        </header>

        <div className="relative min-h-0 flex-1">
          {isLoading || !stops ? (
            <div className="flex h-full items-center justify-center gap-2 bg-muted text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading {isLoading ? "bus stops" : "map"}…
            </div>
          ) : (
            <ClientOnly fallback={<div className="h-full bg-muted" />}>
              <Suspense fallback={<div className="h-full bg-muted" />}>
                <StopPickerMap stops={stops} accent={accent} selected={selected} onSelect={setSelected} />
              </Suspense>
            </ClientOnly>
          )}
          {stops && (
            <div className="pointer-events-none absolute top-3 left-3 z-[400] rounded-md bg-ink/85 px-2 py-1 text-[11px] font-semibold text-ink-foreground">
              {stops.length.toLocaleString()} bus stops
            </div>
          )}
        </div>

        <footer className="flex items-center gap-3 border-t px-4 py-3">
          <div className="min-w-0 flex-1 text-sm">
            {selected ? (
              <>
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Selected stop</span>
                <div className="truncate font-medium">{selected.name}</div>
              </>
            ) : (
              <span className="text-muted-foreground">No stop selected yet.</span>
            )}
          </div>
          <button
            type="button"
            disabled={!selected}
            onClick={() => {
              if (!selected) return;
              onPick({ name: selected.name, lat: selected.latitude, lng: selected.longitude, kind: "stop", detail: "Bus stop" });
              onClose();
            }}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-xl px-4 font-display text-sm font-bold transition",
              selected ? "bg-gold text-gold-foreground hover:brightness-105" : "cursor-not-allowed bg-muted text-muted-foreground",
            )}
          >
            <Check className="size-4" /> Use this stop
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
