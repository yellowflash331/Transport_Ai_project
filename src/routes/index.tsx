import { createFileRoute, Link } from "@tanstack/react-router";
import { BusFront, Database, GitBranch, Route as RouteIcon } from "lucide-react";
import { SearchForm } from "@/components/transit/SearchForm";
import { DemoBanner } from "@/components/transit/DemoBanner";

const TITLE = "TransitAI — Yangon Bus Route Finder";
const DESC = "Find the best bus routes across Yangon: nearest stops, transfers, walking distance, travel time and fare, ranked by your preference.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen paper-grid">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BusFront className="size-4" />
          </span>
          TransitAI
        </Link>
        <span className="rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">Yangon · MVP</span>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 pt-8 pb-16 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:pt-16">
        <div className="animate-rise">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
            <span className="size-1.5 rounded-full bg-gold" /> AI-assisted public transport routing
          </p>
          <h1 className="font-display text-5xl leading-[0.98] font-extrabold tracking-tight md:text-6xl">
            Which bus,
            <br />
            where to get off,
            <br />
            <span className="text-gold-foreground/80 underline decoration-gold decoration-8 underline-offset-4">how much</span>.
          </h1>
          <p className="mt-6 max-w-md text-base text-muted-foreground md:text-lg">
            Type any place — home, a shop, a landmark — as your start and destination. TransitAI finds your nearest bus
            stops, searches every bus combination and ranks the top 3 journeys, with walking distance shown at both ends.
          </p>
          <p className="mt-3 max-w-md rounded-xl border bg-card px-3 py-2 text-xs font-medium text-muted-foreground">
            📍 Your place → 🚶 Walk → 🚌 Bus stop → Route → 🚌 Bus stop → 🚶 Walk → 📍 Destination
          </p>
          <ul className="mt-6 grid max-w-md grid-cols-3 gap-3 text-xs">
            <Feature icon={RouteIcon} title="Nearest stop" text="Any place → closest walkable bus stops" />
            <Feature icon={GitBranch} title="5 preferences" text="Fastest, least walking, cheapest…" />
            <Feature icon={Database} title="Crowding-aware" text="Predicted occupancy per bus leg" />
          </ul>
        </div>

        <div className="animate-rise rounded-3xl border bg-card/90 p-5 shadow-float backdrop-blur md:p-7" style={{ animationDelay: "120ms" }}>
          <h2 className="font-display text-xl font-bold">Plan a journey</h2>
          <p className="mb-5 text-sm text-muted-foreground">Try “Hledan” to “Sule Pagoda”.</p>
          <SearchForm />
          <div className="mt-5">
            <DemoBanner />
          </div>
        </div>
      </section>

      <section className="border-t bg-card/60">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-3">
          <HowStep n="01" title="Find nearby stops" text="Both ends are geocoded from whatever place you type, then several walkable stops around each are considered — not just the closest one." />
          <HowStep n="02" title="Search the network" text="Bus stops are nodes; consecutive stops on a route are edges carrying travel-time data. Transfers and walking legs are part of the graph." />
          <HowStep n="03" title="Rank, explain & predict crowding" text="Time, walking, transfers and fare are combined per your preference, and each bus leg is annotated with predicted occupancy. Explanations only restate computed facts — the AI never invents buses or stops." />
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-5 py-8 text-xs text-muted-foreground">
        Map data © OpenStreetMap contributors. Bus network: YBS open data (CC BY-SA 4.0) — travel times and fares are estimates.
      </footer>
    </main>
  );
}

function Feature({ icon: Icon, title, text }: { icon: typeof RouteIcon; title: string; text: string }) {
  return (
    <li className="rounded-xl border bg-card p-3">
      <Icon className="size-4 text-gold-foreground" />
      <div className="mt-2 font-semibold">{title}</div>
      <div className="text-muted-foreground">{text}</div>
    </li>
  );
}

function HowStep({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div>
      <div className="font-mono text-xs text-gold-foreground/70">{n}</div>
      <h3 className="mt-1 font-display text-lg font-bold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
