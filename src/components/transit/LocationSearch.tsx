import { useEffect, useId, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BusFront, MapPin, Loader2 } from "lucide-react";
import { searchPlaces } from "@/lib/transit/transit.functions";
import type { Place } from "@/lib/transit/types";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  placeholder: string;
  value: Place | null;
  onChange: (p: Place | null) => void;
  markerClassName: string;
}

export function LocationSearch({ label, placeholder, value, onChange, markerClassName }: Props) {
  const id = useId();
  const search = useServerFn(searchPlaces);
  const [text, setText] = useState(value?.name ?? "");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setText(value?.name ?? "");
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const q = text.trim();
    if (q.length < 2 || q === value?.name) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await search({ data: { q } });
        if (!cancelled) setResults(r);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [text, open, value?.name, search]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (p: Place) => {
    onChange(p);
    setText(p.name);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <span className={cn("absolute top-1/2 left-3.5 size-3 -translate-y-1/2 rounded-full ring-4", markerClassName)} />
        <input
          id={id}
          value={text}
          autoComplete="off"
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(0);
            if (value) onChange(null);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!results.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const r = results[active];
              if (r) pick(r);
            } else if (e.key === "Escape") setOpen(false);
          }}
          className="h-12 w-full rounded-xl border border-input bg-card pr-10 pl-9 text-base text-foreground shadow-xs outline-none transition placeholder:text-muted-foreground/70 focus:border-ring focus:ring-3 focus:ring-ring/30"
        />
        {loading && <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      {open && (results.length > 0 || (text.trim().length >= 2 && !loading && text !== value?.name)) && (
        <ul
          role="listbox"
          className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-xl border bg-popover p-1.5 shadow-float animate-rise"
        >
          {results.length === 0 && (
            <li className="px-3 py-3 text-sm text-muted-foreground">No places found in Yangon for “{text}”.</li>
          )}
          {results.map((p, i) => (
            <li
              key={`${p.name}-${p.lat}-${p.lng}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                i === active ? "bg-accent text-accent-foreground" : "hover:bg-muted",
              )}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                {p.kind === "stop" ? <BusFront className="size-4" /> : <MapPin className="size-4" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.name}</span>
                {p.detail && <span className="block truncate text-xs text-muted-foreground">{p.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
