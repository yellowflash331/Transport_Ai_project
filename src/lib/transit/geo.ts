import type { LatLng } from "./types";

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Average walking speed ~ 4.8 km/h => 80 m/min. Street routing adds ~25% over straight line. */
export const WALK_METERS_PER_MIN = 80;
export const WALK_DETOUR_FACTOR = 1.25;

export function walkMinutes(meters: number): number {
  return (meters * WALK_DETOUR_FACTOR) / WALK_METERS_PER_MIN;
}

/** Straight-line → estimated street distance */
export function streetMeters(meters: number): number {
  return Math.round((meters * WALK_DETOUR_FACTOR) / 10) * 10;
}

/** Fallback bus speed when travel_data has no record for an edge (~18 km/h incl. stops). */
export const BUS_METERS_PER_MIN = 300;
