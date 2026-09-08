/**
 * Leaflet stop picker — browser only. Loaded lazily behind <ClientOnly>.
 * Clicking a bus stop marker selects that stop directly; clicking anywhere
 * else on the map drops a pin at that exact point (the nearest stop is
 * worked out later, same as typing a place name).
 */
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import type { BusStop, LatLng } from "@/lib/transit/types";

interface Props {
  stops: BusStop[];
  accent: string;
  selected: BusStop | null;
  pin: LatLng | null;
  onSelect: (s: BusStop) => void;
  onPin: (p: LatLng) => void;
}

export default function StopPickerMap({ stops, accent, selected, pin, onSelect, onPin }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());
  const pinMarkerRef = useRef<L.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onPinRef = useRef(onPin);
  onPinRef.current = onPin;
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
    map.on("click", (e: L.LeafletMouseEvent) => onPinRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
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

  // Dropped-pin marker for an arbitrary (non-stop) point.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (pinMarkerRef.current) {
      pinMarkerRef.current.remove();
      pinMarkerRef.current = null;
    }
    if (pin) {
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:16px;height:16px;border-radius:50% 50% 50% 0;background:${accent};border:2px solid white;transform:rotate(-45deg);box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 15],
      });
      pinMarkerRef.current = L.marker([pin.lat, pin.lng], { icon }).addTo(map);
      map.panTo([pin.lat, pin.lng]);
    }
  }, [pin, accent]);

  return <div ref={containerRef} className="h-full w-full" aria-label="Choose a bus stop or any place on the map" />;
}
