/**
 * Leaflet map — browser only. Loaded lazily behind <ClientOnly> from the results route.
 */
import { useEffect, useRef } from "react";
import L from "leaflet";
import type { BusStop, Journey, Place } from "@/lib/transit/types";

const ROUTE_COLORS = [
  "oklch(0.6 0.2 25)",
  "oklch(0.55 0.16 250)",
  "oklch(0.62 0.16 150)",
  "oklch(0.6 0.19 320)",
  "oklch(0.7 0.16 60)",
  "oklch(0.55 0.13 200)",
];

interface Props {
  origin: Place;
  destination: Place;
  journeys: Journey[];
  selectedId: string;
  candidateStops: { origin: BusStop[]; destination: BusStop[] };
}

function pin(color: string, label: string) {
  return L.divIcon({
    className: "transit-marker",
    html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-4px)">
      <div style="background:${color};color:white;font:700 11px 'IBM Plex Sans',sans-serif;padding:3px 8px;border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.25);white-space:nowrap">${label}</div>
      <div style="width:10px;height:10px;background:${color};border:2px solid white;border-radius:999px;margin-top:2px;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>
    </div>`,
    iconAnchor: [0, 30],
  });
}

function stopDot(color: string, size = 10) {
  return L.divIcon({
    className: "transit-marker",
    html: `<div style="width:${size}px;height:${size}px;background:white;border:3px solid ${color};border-radius:999px;box-shadow:0 1px 3px rgba(0,0,0,.3)"></div>`,
    iconAnchor: [size / 2, size / 2],
  });
}

export default function RouteMap({ origin, destination, journeys, selectedId, candidateStops }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    map.setView([16.8, 96.155], 12);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const bounds = L.latLngBounds([]);
    const walkStyle = { color: "oklch(0.45 0.03 160)", weight: 3, dashArray: "6 8", opacity: 0.9 };

    // Draw non-selected journeys first (faded), then the selected one on top.
    const ordered = [...journeys.filter((j) => j.id !== selectedId), ...journeys.filter((j) => j.id === selectedId)];
    for (const j of ordered) {
      const isSel = j.id === selectedId;
      for (const leg of j.legs) {
        if (leg.kind === "walk") {
          if (!isSel) continue;
          L.polyline(
            [
              [leg.from.lat, leg.from.lng],
              [leg.to.lat, leg.to.lng],
            ],
            walkStyle,
          ).addTo(layer);
        } else {
          const pts = leg.stops.map((s) => [s.latitude, s.longitude] as [number, number]);
          const color = ROUTE_COLORS[leg.colorIndex % ROUTE_COLORS.length] ?? ROUTE_COLORS[0]!;
          if (isSel) {
            L.polyline(pts, { color: "white", weight: 10, opacity: 0.9, lineCap: "round" }).addTo(layer);
            L.polyline(pts, { color, weight: 6, opacity: 1, lineCap: "round" }).addTo(layer);
            for (const s of leg.stops) {
              L.marker([s.latitude, s.longitude], { icon: stopDot(color, s === leg.boardStop || s === leg.alightStop ? 14 : 9) })
                .bindTooltip(`${s.name}`, { direction: "top", offset: [0, -6] })
                .addTo(layer);
              bounds.extend([s.latitude, s.longitude]);
            }
          } else {
            L.polyline(pts, { color: "oklch(0.55 0.02 160)", weight: 4, opacity: 0.3, dashArray: "2 6" }).addTo(layer);
          }
        }
      }
    }

    for (const s of [...candidateStops.origin, ...candidateStops.destination]) {
      L.circleMarker([s.latitude, s.longitude], { radius: 4, color: "oklch(0.6 0.03 160)", weight: 1, fillOpacity: 0.4 })
        .bindTooltip(`${s.name} (nearby stop)`, { direction: "top" })
        .addTo(layer);
    }

    L.marker([origin.lat, origin.lng], { icon: pin("oklch(0.55 0.14 150)", "START") }).addTo(layer);
    L.marker([destination.lat, destination.lng], { icon: pin("oklch(0.6 0.2 25)", "END") }).addTo(layer);
    bounds.extend([origin.lat, origin.lng]);
    bounds.extend([destination.lat, destination.lng]);
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
  }, [journeys, selectedId, origin, destination, candidateStops]);

  return <div ref={containerRef} className="h-full w-full" aria-label="Route map" />;
}
