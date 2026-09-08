/**
 * Deterministic route engine.
 *
 * The network is modelled as a graph:
 *   nodes  = (bus stop, route currently riding | null)
 *   edges  = ride to next stop on the same route (travel_data minutes)
 *          | board a route at this stop (wait + transfer penalty)
 *          | walk to a nearby stop (transfer on foot)
 *          | walk from origin / to destination
 *
 * A generalised Dijkstra minimises a weighted cost that depends on the
 * user's preference. Several searches with different exclusions produce a
 * pool of distinct candidate journeys, which are then ranked. No AI is
 * involved here; everything is derived from the network records.
 */
import type {
  BusLeg,
  BusRoute,
  BusStop,
  Journey,
  JourneyLeg,
  Place,
  Preference,
  RouteRequest,
  RouteResponse,
  TransitNetwork,
  WalkLeg,
} from "./types";
import { BUS_METERS_PER_MIN, haversineMeters, streetMeters, walkMinutes } from "./geo";
import { explainJourney } from "./explain";

/* ---------- Tunables ---------- */
const MAX_ACCESS_WALK_M = 1200; // origin/destination → stop
const MAX_TRANSFER_WALK_M = 450; // stop → stop on foot
const ACCESS_STOP_CANDIDATES = 5;
const BOARD_WAIT_MIN = 6; // average wait when boarding
const TRANSFER_PENALTY_MIN = 4; // discomfort of changing buses (in cost units only)
const MAX_TRANSFERS = 3;

interface Weights {
  time: number; // per minute in-vehicle / waiting
  walk: number; // per minute walking
  transfer: number; // per transfer
  fare: number; // per currency unit
}

const WEIGHTS: Record<Preference, Weights> = {
  recommended: { time: 1, walk: 1.6, transfer: 8, fare: 0.01 },
  fastest: { time: 1, walk: 1, transfer: 0.5, fare: 0 },
  least_walking: { time: 0.4, walk: 6, transfer: 2, fare: 0 },
  fewest_transfers: { time: 0.6, walk: 1.2, transfer: 40, fare: 0 },
  cheapest: { time: 0.3, walk: 1, transfer: 1, fare: 0.4 },
};

/* ---------- Graph construction ---------- */

interface RideEdge {
  toStopId: string;
  minutes: number;
}

export interface Graph {
  stops: Map<string, BusStop>;
  routes: Map<string, BusRoute>;
  fares: Map<string, number>;
  /** routeId → stopId → forward + backward ride edges */
  ride: Map<string, Map<string, RideEdge[]>>;
  /** stopId → routeIds serving it */
  servedBy: Map<string, string[]>;
  /** stopId → nearby stops reachable on foot */
  footTransfers: Map<string, { toStopId: string; meters: number }[]>;
}

/** Graphs are pure functions of (network, time bucket), so cache them per network instance. */
const graphCache = new WeakMap<TransitNetwork, Map<string, Graph>>();

export function getGraph(network: TransitNetwork, timeOfDay = "all", dayOfWeek = "all"): Graph {
  let byKey = graphCache.get(network);
  if (!byKey) {
    byKey = new Map();
    graphCache.set(network, byKey);
  }
  const k = `${timeOfDay}|${dayOfWeek}`;
  let g = byKey.get(k);
  if (!g) {
    g = buildGraph(network, timeOfDay, dayOfWeek);
    byKey.set(k, g);
  }
  return g;
}

export function buildGraph(network: TransitNetwork, timeOfDay = "all", dayOfWeek = "all"): Graph {
  const stops = new Map(network.stops.map((s) => [s.id, s]));
  const routes = new Map(network.routes.map((r) => [r.id, r]));
  const fares = new Map(network.fares.map((f) => [f.route_id, f.fare]));

  // travel_data lookup with fallback: exact tod/dow → "all" → any record → distance estimate
  const td = new Map<string, number>();
  const key = (r: string, a: string, b: string, t: string, d: string) => `${r}|${a}|${b}|${t}|${d}`;
  for (const row of network.travelData) {
    td.set(key(row.route_id, row.from_stop_id, row.to_stop_id, row.time_of_day, row.day_of_week), row.average_travel_minutes);
  }
  const anyByEdge = new Map<string, number[]>();
  for (const row of network.travelData) {
    const k = `${row.route_id}|${row.from_stop_id}|${row.to_stop_id}`;
    anyByEdge.set(k, [...(anyByEdge.get(k) ?? []), row.average_travel_minutes]);
  }
  const minutesFor = (r: string, a: string, b: string): number => {
    const candidates = [
      key(r, a, b, timeOfDay, dayOfWeek),
      key(r, a, b, timeOfDay, "all"),
      key(r, a, b, "all", dayOfWeek),
      key(r, a, b, "all", "all"),
      key(r, a, b, "offpeak", "all"),
    ];
    for (const c of candidates) {
      const v = td.get(c);
      if (v !== undefined) return v;
    }
    const any = anyByEdge.get(`${r}|${a}|${b}`);
    if (any?.length) return any.reduce((x, y) => x + y, 0) / any.length;
    const sa = stops.get(a);
    const sb = stops.get(b);
    if (!sa || !sb) return 5;
    return Math.max(1, haversineMeters(toLL(sa), toLL(sb)) / BUS_METERS_PER_MIN);
  };

  const ride = new Map<string, Map<string, RideEdge[]>>();
  const servedBy = new Map<string, string[]>();
  const byRoute = new Map<string, typeof network.routeStops>();
  for (const rs of network.routeStops) {
    byRoute.set(rs.route_id, [...(byRoute.get(rs.route_id) ?? []), rs]);
  }
  for (const [routeId, list] of byRoute) {
    if (!routes.has(routeId)) continue;
    const seq = [...list].sort((a, b) => a.stop_sequence - b.stop_sequence).filter((rs) => stops.has(rs.stop_id));
    const adj = new Map<string, RideEdge[]>();
    for (let i = 0; i < seq.length; i++) {
      const sid = seq[i]!.stop_id;
      const nextId = seq[i + 1]?.stop_id;
      const prevId = seq[i - 1]?.stop_id;
      servedBy.set(sid, [...new Set([...(servedBy.get(sid) ?? []), routeId])]);
      const edges: RideEdge[] = [];
      // Routes are treated as bidirectional (both directions of service).
      if (nextId) edges.push({ toStopId: nextId, minutes: minutesFor(routeId, sid, nextId) });
      if (prevId) edges.push({ toStopId: prevId, minutes: minutesFor(routeId, sid, prevId) });
      adj.set(sid, [...(adj.get(sid) ?? []), ...edges]);
    }
    ride.set(routeId, adj);
  }

  // Foot transfers via a coarse lat/lng grid so large networks stay fast (no O(n²) scan).
  const footTransfers = new Map<string, { toStopId: string; meters: number }[]>();
  const all = network.stops.filter((s) => servedBy.has(s.id));
  const cellDeg = MAX_TRANSFER_WALK_M / 111_000; // ~1 cell = max transfer distance
  const cellOf = (s: BusStop) => `${Math.floor(s.latitude / cellDeg)}|${Math.floor(s.longitude / cellDeg)}`;
  const grid = new Map<string, BusStop[]>();
  for (const s of all) grid.set(cellOf(s), [...(grid.get(cellOf(s)) ?? []), s]);
  for (const a of all) {
    const near: { toStopId: string; meters: number }[] = [];
    const cy = Math.floor(a.latitude / cellDeg);
    const cx = Math.floor(a.longitude / cellDeg);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const b of grid.get(`${cy + dy}|${cx + dx}`) ?? []) {
          if (a.id === b.id) continue;
          const m = haversineMeters(toLL(a), toLL(b));
          if (m <= MAX_TRANSFER_WALK_M) near.push({ toStopId: b.id, meters: m });
        }
      }
    }
    footTransfers.set(a.id, near);
  }

  return { stops, routes, fares, ride, servedBy, footTransfers };
}

const toLL = (s: BusStop) => ({ lat: s.latitude, lng: s.longitude });

/* ---------- Nearby stops ---------- */

export function nearbyStops(graph: Graph, p: Place, limit = ACCESS_STOP_CANDIDATES, maxMeters = MAX_ACCESS_WALK_M) {
  return [...graph.stops.values()]
    .map((s) => ({ stop: s, meters: haversineMeters(p, toLL(s)) }))
    .filter((x) => x.meters <= maxMeters && (graph.servedBy.get(x.stop.id)?.length ?? 0) > 0)
    .sort((a, b) => a.meters - b.meters)
    .slice(0, limit);
}

/* ---------- Dijkstra ---------- */

type Action =
  | { type: "walk"; fromStopId: string | null; toStopId: string | null; meters: number }
  | { type: "board"; stopId: string; routeId: string }
  | { type: "ride"; routeId: string; fromStopId: string; toStopId: string; minutes: number };

interface State {
  stopId: string | "ORIGIN" | "DEST";
  routeId: string | null; // currently on board
  transfers: number;
}

interface Label {
  cost: number;
  minutes: number;
  walkMeters: number;
  fare: number;
  rode: boolean;
  prev: string | null;
  action: Action | null;
  state: State;
}

const stateKey = (s: State) => `${s.stopId}|${s.routeId ?? "-"}|${s.transfers}`;

class MinHeap {
  private a: { k: number; v: string }[] = [];
  private at(i: number) {
    return this.a[i]!;
  }
  push(k: number, v: string) {
    this.a.push({ k, v });
    let i = this.a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.at(p).k <= this.at(i).k) break;
      [this.a[p], this.a[i]] = [this.at(i), this.at(p)];
      i = p;
    }
  }
  pop() {
    if (!this.a.length) return undefined;
    const top = this.a[0];
    const last = this.a.pop()!;
    if (this.a.length) {
      this.a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.a.length && this.at(l).k < this.at(m).k) m = l;
        if (r < this.a.length && this.at(r).k < this.at(m).k) m = r;
        if (m === i) break;
        [this.a[m], this.a[i]] = [this.at(i), this.at(m)];
        i = m;
      }
    }
    return top;
  }
  get size() {
    return this.a.length;
  }
}

interface SearchOptions {
  weights: Weights;
  excludeRoutes?: Set<string>;
  excludeBoardStops?: Set<string>;
}

function search(
  graph: Graph,
  origin: Place,
  destination: Place,
  originStops: { stop: BusStop; meters: number }[],
  destStops: { stop: BusStop; meters: number }[],
  opts: SearchOptions,
): Label[] | null {
  const { weights } = opts;
  const labels = new Map<string, Label>();
  const heap = new MinHeap();
  const destByStop = new Map(destStops.map((d) => [d.stop.id, d.meters]));

  const start: State = { stopId: "ORIGIN", routeId: null, transfers: 0 };
  labels.set(stateKey(start), { cost: 0, minutes: 0, walkMeters: 0, fare: 0, rode: false, prev: null, action: null, state: start });
  heap.push(0, stateKey(start));

  const relax = (fromKey: string, next: State, add: { cost: number; minutes: number; walk: number; fare: number }, action: Action) => {
    const from = labels.get(fromKey)!;
    const nk = stateKey(next);
    const cost = from.cost + add.cost;
    const existing = labels.get(nk);
    if (existing && existing.cost <= cost) return;
    labels.set(nk, {
      cost,
      minutes: from.minutes + add.minutes,
      walkMeters: from.walkMeters + add.walk,
      fare: from.fare + add.fare,
      rode: from.rode || action.type === "ride",
      prev: fromKey,
      action,
      state: next,
    });
    heap.push(cost, nk);
  };

  const closed = new Set<string>();
  while (heap.size) {
    const { k, v } = heap.pop()!;
    if (closed.has(v)) continue;
    const label = labels.get(v)!;
    if (label.cost !== k) continue;
    closed.add(v);
    const st = label.state;

    if (st.stopId === "DEST") {
      const path: Label[] = [];
      let cur: Label | undefined = label;
      while (cur) {
        path.unshift(cur);
        cur = cur.prev ? labels.get(cur.prev) : undefined;
      }
      return path;
    }

    if (st.stopId === "ORIGIN") {
      for (const { stop, meters } of originStops) {
        const mins = walkMinutes(meters);
        relax(v, { stopId: stop.id, routeId: null, transfers: 0 }, { cost: mins * weights.walk, minutes: mins, walk: streetMeters(meters), fare: 0 }, {
          type: "walk",
          fromStopId: null,
          toStopId: stop.id,
          meters: streetMeters(meters),
        });
      }
      continue;
    }

    // Alight here and walk to destination (only if we have ridden at least one bus).
    const dm = destByStop.get(st.stopId);
    if (dm !== undefined && label.rode) {
      const mins = walkMinutes(dm);
      relax(v, { stopId: "DEST", routeId: null, transfers: st.transfers }, { cost: mins * weights.walk, minutes: mins, walk: streetMeters(dm), fare: 0 }, {
        type: "walk",
        fromStopId: st.stopId,
        toStopId: null,
        meters: streetMeters(dm),
      });
    }

    if (st.routeId) {
      // Continue riding
      for (const e of graph.ride.get(st.routeId)?.get(st.stopId) ?? []) {
        relax(v, { ...st, stopId: e.toStopId }, { cost: e.minutes * weights.time, minutes: e.minutes, walk: 0, fare: 0 }, {
          type: "ride",
          routeId: st.routeId,
          fromStopId: st.stopId,
          toStopId: e.toStopId,
          minutes: e.minutes,
        });
      }
      // Alight (become a pedestrian at this stop)
      relax(v, { stopId: st.stopId, routeId: null, transfers: st.transfers }, { cost: 0, minutes: 0, walk: 0, fare: 0 }, {
        type: "walk",
        fromStopId: st.stopId,
        toStopId: st.stopId,
        meters: 0,
      });
    } else {
      // Board any route here
      const isTransfer = label.rode;
      if (!isTransfer || st.transfers < MAX_TRANSFERS) {
        for (const routeId of graph.servedBy.get(st.stopId) ?? []) {
          if (opts.excludeRoutes?.has(routeId)) continue;
          if (!isTransfer && opts.excludeBoardStops?.has(st.stopId)) continue;
          const fare = graph.fares.get(routeId) ?? 0;
          const penalty = isTransfer ? TRANSFER_PENALTY_MIN * weights.time + weights.transfer : 0;
          relax(
            v,
            { stopId: st.stopId, routeId, transfers: st.transfers + (isTransfer ? 1 : 0) },
            { cost: BOARD_WAIT_MIN * weights.time + fare * weights.fare + penalty, minutes: BOARD_WAIT_MIN, walk: 0, fare },
            { type: "board", stopId: st.stopId, routeId },
          );
        }
      }
      // Walk to a nearby stop (foot transfer) — only after riding, to avoid trivial pre-walks
      if (isTransfer) {
        for (const f of graph.footTransfers.get(st.stopId) ?? []) {
          const mins = walkMinutes(f.meters);
          relax(v, { stopId: f.toStopId, routeId: null, transfers: st.transfers }, { cost: mins * weights.walk, minutes: mins, walk: streetMeters(f.meters), fare: 0 }, {
            type: "walk",
            fromStopId: st.stopId,
            toStopId: f.toStopId,
            meters: streetMeters(f.meters),
          });
        }
      }
    }
  }
  return null;
}

/* ---------- Path → Journey ---------- */

function toJourney(graph: Graph, path: Label[], origin: Place, destination: Place, preference: Preference, id: string): Journey {
  const legs: JourneyLeg[] = [];
  let currentBus: BusLeg | null = null;
  let waitMinutes = 0;
  const colorByRoute = new Map<string, number>();

  const point = (stopId: string | null, fallback: Place) => {
    if (!stopId) return { name: fallback.name, lat: fallback.lat, lng: fallback.lng };
    const s = graph.stops.get(stopId)!;
    return { name: s.name, lat: s.latitude, lng: s.longitude };
  };

  for (const label of path) {
    const a = label.action;
    if (!a) continue;
    if (a.type === "walk") {
      if (currentBus) {
        legs.push(currentBus);
        currentBus = null;
      }
      if (a.fromStopId === a.toStopId) continue; // alight marker
      if (a.meters < 20) continue; // origin/destination is effectively at the stop
      const leg: WalkLeg = {
        kind: "walk",
        from: point(a.fromStopId, origin),
        to: point(a.toStopId, destination),
        distanceMeters: a.meters,
        minutes: walkMinutes(a.meters / 1.25),
      };
      legs.push(leg);
    } else if (a.type === "board") {
      const route = graph.routes.get(a.routeId)!;
      const stop = graph.stops.get(a.stopId)!;
      if (!colorByRoute.has(a.routeId)) colorByRoute.set(a.routeId, colorByRoute.size);
      waitMinutes += BOARD_WAIT_MIN;
      currentBus = {
        kind: "bus",
        routeId: route.id,
        routeNumber: route.route_number,
        routeName: route.route_name,
        boardStop: stop,
        alightStop: stop,
        stops: [stop],
        hops: [],
        minutes: 0,
        fare: graph.fares.get(route.id) ?? 0,
        colorIndex: colorByRoute.get(a.routeId)!,
      };
    } else if (a.type === "ride" && currentBus) {
      const stop = graph.stops.get(a.toStopId)!;
      const prev = graph.stops.get(a.fromStopId)!;
      currentBus.stops.push(stop);
      currentBus.hops.push({ fromStopId: a.fromStopId, toStopId: a.toStopId, minutes: a.minutes, meters: Math.round(haversineMeters(toLL(prev), toLL(stop))) });
      currentBus.alightStop = stop;
      currentBus.minutes += a.minutes;
    }
  }
  if (currentBus) legs.push(currentBus);

  const busLegs = legs.filter((l): l is BusLeg => l.kind === "bus");
  const walkLegs = legs.filter((l): l is WalkLeg => l.kind === "walk");
  const busMinutes = busLegs.reduce((s, l) => s + l.minutes, 0);
  const walkMins = walkLegs.reduce((s, l) => s + l.minutes, 0);
  const walkMeters = walkLegs.reduce((s, l) => s + l.distanceMeters, 0);
  const fare = busLegs.reduce((s, l) => s + l.fare, 0);
  const totalMinutes = Math.round(busMinutes + walkMins + waitMinutes);
  const last = path[path.length - 1]!;

  const journey: Journey = {
    id,
    legs,
    totalMinutes,
    busMinutes: Math.round(busMinutes),
    walkMinutes: Math.round(walkMins),
    waitMinutes,
    walkMeters: Math.round(walkMeters),
    busCount: busLegs.length,
    transferCount: Math.max(0, busLegs.length - 1),
    fare,
    score: last.cost,
    explanation: [],
    badges: [],
  };
  journey.explanation = explainJourney(journey, preference);
  return journey;
}

const signature = (j: Journey) =>
  j.legs
    .filter((l): l is BusLeg => l.kind === "bus")
    .map((l) => `${l.routeId}:${l.boardStop.id}>${l.alightStop.id}`)
    .join("|");

function scoreFor(j: Journey, w: Weights) {
  return (j.busMinutes + j.waitMinutes) * w.time + j.walkMinutes * w.walk + j.transferCount * w.transfer + j.fare * w.fare;
}

/* ---------- Public API ---------- */

export function findRoutes(network: TransitNetwork, req: RouteRequest): RouteResponse {
  const t0 = Date.now();
  const graph = getGraph(network, req.timeOfDay ?? "all", req.dayOfWeek ?? "all");
  const originStops = nearbyStops(graph, req.origin);
  const destStops = nearbyStops(graph, req.destination);
  const pool = new Map<string, Journey>();
  let n = 0;

  const run = (opts: SearchOptions) => {
    const path = search(graph, req.origin, req.destination, originStops, destStops, opts);
    if (!path) return null;
    const j = toJourney(graph, path, req.origin, req.destination, req.preference, `j${++n}`);
    if (j.busCount === 0) return null;
    const sig = signature(j);
    if (!pool.has(sig)) pool.set(sig, j);
    return j;
  };

  const primaryWeights = WEIGHTS[req.preference];
  const first = run({ weights: primaryWeights });

  if (first) {
    // Diversify: forbid each bus route used by the best journey, and each boarding stop.
    const usedRoutes = first.legs.filter((l): l is BusLeg => l.kind === "bus").map((l) => l.routeId);
    for (const r of usedRoutes) run({ weights: primaryWeights, excludeRoutes: new Set([r]) });
    const firstBoard = first.legs.find((l): l is BusLeg => l.kind === "bus")?.boardStop.id;
    if (firstBoard) run({ weights: primaryWeights, excludeBoardStops: new Set([firstBoard]) });
  }
  // Also consider what other preference profiles would pick.
  for (const p of Object.keys(WEIGHTS) as Preference[]) {
    if (p !== req.preference) run({ weights: WEIGHTS[p] });
  }

  const ranked = [...pool.values()]
    .map((j) => ({ ...j, score: scoreFor(j, primaryWeights) }))
    .sort((a, b) => a.score - b.score || a.totalMinutes - b.totalMinutes)
    .slice(0, 3)
    .map((j, i) => ({ ...j, id: `route-${i + 1}`, badges: badgesFor(j, i) }));

  // Recompute explanations with rank context
  for (const j of ranked) j.explanation = explainJourney(j, req.preference, ranked);

  return {
    journeys: ranked,
    origin: req.origin,
    destination: req.destination,
    preference: req.preference,
    network: network.source,
    candidateStops: { origin: originStops.map((s) => s.stop), destination: destStops.map((s) => s.stop) },
    computedInMs: Date.now() - t0,
  };
}

function badgesFor(j: Journey, rank: number) {
  const b: string[] = [];
  if (rank === 0) b.push("Best match");
  if (j.transferCount === 0) b.push("Direct");
  return b;
}

export function badgesAcross(journeys: Journey[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  if (!journeys.length) return out;
  const min = (f: (j: Journey) => number) => Math.min(...journeys.map(f));
  for (const j of journeys) {
    const arr = [...j.badges];
    if (journeys.length > 1) {
      if (j.totalMinutes === min((x) => x.totalMinutes)) arr.push("Fastest");
      if (j.walkMeters === min((x) => x.walkMeters)) arr.push("Least walking");
      if (j.fare === min((x) => x.fare)) arr.push("Cheapest");
    }
    out.set(j.id, [...new Set(arr)]);
  }
  return out;
}
