/**
 * Leaflet stop picker — browser only. Loaded lazily behind <ClientOnly>.
 * Only bus stops are selectable; clicking empty map does nothing.
 */
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import type { BusStop } from "@/lib/transit/types";

interface Props {
  stops: BusStop[];
  accent: string;
  selected: BusStop | null;
  onSelect: (s: BusStop) => void;
}

export default function StopPickerMap({ stops, accent, selected, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [zoom, setZoom] = useState(12);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false, preferCanvas: true });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    map.setView([16.8, 96.155], 12);
    map.on("zoomend", () => setZoom(map.getZoom()));
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Draw all stops once.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    markersRef.current.clear();
    for (const s of stops) {
      const m = L.circleMarker([s.latitude, s.longitude], {
        radius: 6,
        color: accent,
        weight: 2,
        fillColor: "white",
        fillOpacity: 1,
        bubblingMouseEvents: false,
      })
        .bindTooltip(s.name, { direction: "top", offset: [0, -6] })
        .on("click", () => onSelectRef.current(s))
        .addTo(layer);
      markersRef.current.set(s.id, m);
    }
  }, [stops, accent]);

  // Scale markers with zoom and highlight the selection.
  useEffect(() => {
    const r = zoom >= 15 ? 8 : zoom >= 13 ? 6 : 4;
    for (const [id, m] of markersRef.current) {
      const isSel = id === selected?.id;
      m.setStyle({ fillColor: isSel ? accent : "white", weight: isSel ? 3 : 2 });
      m.setRadius(isSel ? r + 4 : r);
      if (isSel) m.bringToFront();
    }
  }, [zoom, selected, accent]);

  useEffect(() => {
    if (selected && mapRef.current) mapRef.current.panTo([selected.latitude, selected.longitude]);
  }, [selected]);

  return <div ref={containerRef} className="h-full w-full" aria-label="Choose a bus stop on the map" />;
}
