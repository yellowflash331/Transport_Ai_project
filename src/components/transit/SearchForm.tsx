import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpDown, MapPinned, Search } from "lucide-react";
import { LocationSearch } from "./LocationSearch";
import { StopPickerDialog } from "./StopPickerDialog";
import type { Place } from "@/lib/transit/types";
import { cn } from "@/lib/utils";

interface Props {
  initial?: { origin: Place | null; destination: Place | null };
  compact?: boolean;
}

function MapPickButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary hover:underline"
    >
      <MapPinned className="size-3.5" /> Choose from the map
    </button>
  );
}

export function SearchForm({ initial, compact }: Props) {
  const navigate = useNavigate();
  const [origin, setOrigin] = useState<Place | null>(initial?.origin ?? null);
  const [destination, setDestination] = useState<Place | null>(initial?.destination ?? null);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<"origin" | "destination" | null>(null);
  const closePicker = useCallback(() => setPicker(null), []);

  const swap = () => {
    setOrigin(destination);
    setDestination(origin);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin || !destination) {
      setError("Pick both a start and a destination from the suggestions.");
      return;
    }
    setError(null);
    navigate({
      to: "/results",
      search: {
        from: origin.name,
        fromLat: origin.lat,
        fromLng: origin.lng,
        to: destination.name,
        toLat: destination.lat,
        toLng: destination.lng,
      },
    });
  };

  return (
    <form onSubmit={submit} className={cn("space-y-5", compact && "space-y-4")}>
      <div className="relative grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-start">
        <div>
          <LocationSearch
            label="From"
            placeholder="Any place, e.g. your street or Hledan"
            value={origin}
            onChange={setOrigin}
            markerClassName="bg-success ring-success/20"
          />
          <MapPickButton onClick={() => setPicker("origin")} />
        </div>
        <button
          type="button"
          onClick={swap}
          aria-label="Swap locations"
          className="mx-auto flex size-11 items-center justify-center rounded-full border bg-card text-foreground shadow-xs transition hover:rotate-180 hover:bg-accent md:mt-6"
        >
          <ArrowUpDown className="size-4" />
        </button>
        <div>
          <LocationSearch
            label="To"
            placeholder="Any destination, e.g. Shwedagon Pagoda"
            value={destination}
            onChange={setDestination}
            markerClassName="bg-route-1 ring-route-1/20"
          />
          <MapPickButton onClick={() => setPicker("destination")} />
        </div>
      </div>

      <p className="-mt-1.5 text-xs text-muted-foreground">
        📍 Type any place — we'll find your nearest bus stop and show you exactly how far to walk.
      </p>

      <StopPickerDialog
        open={picker !== null}
        title={picker === "origin" ? "Choose your start point" : "Choose your destination"}
        accent={picker === "origin" ? "oklch(0.55 0.14 150)" : "oklch(0.6 0.2 25)"}
        onClose={closePicker}
        onPick={(p) => (picker === "origin" ? setOrigin(p) : setDestination(p))}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gold px-6 font-display text-base font-bold text-gold-foreground shadow-card transition hover:brightness-105 active:scale-[0.99] md:w-auto"
      >
        <Search className="size-4 transition group-hover:scale-110" />
        Find Route
      </button>
    </form>
  );
}
