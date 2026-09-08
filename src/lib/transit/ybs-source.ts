/**
 * Real Yangon Bus Service (YBS) network, loaded from the CSV files in ./data/ybs.
 * Source: thantthet/YBS-Data (CC BY-SA 4.0), derived from the official YRTA open data.
 *
 * The CSVs contain stops and stop sequences only. Travel times are estimated by the
 * engine from distance, and fares use an assumed flat fare — both are labelled as such.
 */
import type { TransitDataSource } from "./data-source";
import { networkFromCsv } from "./data-source";
import type { TransitNetwork } from "./types";
import busStopsCsv from "./data/ybs/bus_stops.csv?raw";
import busRoutesCsv from "./data/ybs/bus_routes.csv?raw";
import routeStopsCsv from "./data/ybs/route_stops.csv?raw";

/** Assumed standard YBS flat fare per bus ride (MMK). Not part of the dataset. */
export const ASSUMED_FLAT_FARE_MMK = 200;

let cached: TransitNetwork | null = null;

export function loadYbsNetwork(): TransitNetwork {
  if (cached) return cached;
  const base = networkFromCsv({
    bus_stops: busStopsCsv,
    bus_routes: busRoutesCsv,
    route_stops: routeStopsCsv,
    travel_data: "",
    fares: "",
  });
  cached = {
    ...base,
    fares: base.routes.map((r) => ({ id: `fare-${r.id}`, route_id: r.id, fare: ASSUMED_FLAT_FARE_MMK })),
    source: {
      label: "Yangon Bus Service (YBS) open data",
      isDemo: false,
      currency: "MMK",
      attribution: "YBS Data (thantthet & contributors), based on YRTA open data · CC BY-SA 4.0",
      attributionUrl: "https://github.com/thantthet/YBS-Data",
      notes: [
        `Fares assume the standard ${ASSUMED_FLAT_FARE_MMK} MMK flat fare per bus (not in the dataset).`,
        "Travel times are estimated from stop-to-stop distance until real travel records are imported.",
        "Route data is community-maintained and may be out of date.",
      ],
    },
  };
  return cached;
}

export const ybsDataSource: TransitDataSource = {
  async loadNetwork() {
    return loadYbsNetwork();
  },
};
