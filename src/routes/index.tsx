import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BusFront,
  Database,
  GitBranch,
  Route as RouteIcon,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { SearchForm } from "@/components/transit/SearchForm";
import { PrologConsoleDialog } from "@/components/transit/PrologConsoleDialog";

const TITLE = "TransitAI — Yangon Bus Route Finder";
const DESC =
  "Find the best bus routes across Yangon: nearest stops, transfers, walking distance, travel time and fare.";

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
  const [prologOpen, setPrologOpen] = useState(false);

  return (
    <main className="min-h-screen paper-grid">
      <PrologConsoleDialog open={prologOpen} onClose={() => setPrologOpen(false)} />

      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Link
            to="/"
            className="group flex items-center gap-2.5 rounded-xl font-display text-lg font-bold tracking-tight focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-8 items-center justify-center rounded-xl bg-gold text-gold-foreground shadow-card transition-transform duration-300 group-hover:-rotate-6">
              <BusFront className="size-4" />
            </span>
            TransitAI
          </Link>
          <span className="hidden items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground sm:inline-flex">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            Live · Yangon, Myanmar
          </span>
        </div>
      </header>

      <section className="relative mx-auto grid max-w-6xl gap-12 px-5 pt-12 pb-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-14 lg:pt-20">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-24 size-[28rem] hero-glow blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-24 size-80 hero-glow blur-3xl opacity-70"
        />

        <div className="relative animate-rise">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-foreground uppercase">
            <span className="size-1.5 rounded-full bg-gold shadow-[0_0_8px_var(--color-gold)]" />
            AI & Prolog-assisted public transport routing
          </p>
          <h1 className="font-display text-5xl leading-[1.02] font-extrabold tracking-tight md:text-6xl">
            Which bus,
            <br />
            where to get off,
            <br />
            <span className="text-gradient-gold underline decoration-gold/60 decoration-8 underline-offset-4">
              how much
            </span>
            .
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground md:text-lg">
            TransitAI
            finds your nearest bus stops, searches every bus combination and ranks the top 3
            journeys, with walking distance shown at both ends.
          </p>
          <ul className="mt-8 grid max-w-md grid-cols-2 gap-3 sm:grid-cols-4">
            <Feature
              icon={RouteIcon}
              title="Nearest stop"
              text="Any place → closest walkable bus stops"
            />
            <Feature
              icon={ShieldCheck}
              title="Prolog Rules"
              text="14,503 logic facts & deduction rules"
            />
            <Feature
              icon={GitBranch}
              title="Traffic-aware"
              text="Rush-hour delay factored into travel time"
            />
            <Feature
              icon={Database}
              title="Crowding-aware"
              text="Predicted occupancy per bus leg"
            />
          </ul>
        </div>

        <div className="relative animate-rise" style={{ animationDelay: "120ms" }}>
          <div className="relative overflow-hidden rounded-3xl border bg-card/95 p-6 shadow-float backdrop-blur md:p-8">
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gold via-warning to-gold"
            />
            <h2 className="font-display text-xl font-bold tracking-tight">Plan a journey</h2>
            <p className="mt-1 mb-6 text-sm text-muted-foreground">
              Try “Hledan” to “Sule Pagoda”.
            </p>
            <SearchForm />
          </div>
        </div>
      </section>

      <section className="border-y bg-card/70">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-8 px-5 py-9 sm:grid-cols-4">
          <Stat value="2,080" label="Bus stops" />
          <Stat value="118" label="Bus routes" />
          <Stat value="14,503" label="Logic facts" />
          <Stat value="0" label="Invented routes" />
        </div>
      </section>

      <section className="bg-card/60">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <div className="mb-12 text-center">
            <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-gold-foreground/70 uppercase">
              How it works
            </p>
            <h2 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
              Three steps to your next bus
            </h2>
          </div>
          <div className="relative grid gap-10 md:grid-cols-3 md:gap-12">
            <span
              aria-hidden
              className="absolute top-6 left-[16.66%] right-[16.66%] hidden h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent md:block"
            />
            <HowStep
              n="01"
              title="Find nearby stops"
              text="Both ends are geocoded from whatever place you type, then several walkable stops around each are considered — not just the closest one."
            />
            <HowStep
              n="02"
              title="Search the network"
              text="Bus stops are nodes; consecutive stops on a route are edges carrying travel-time data. Transfers and walking legs are part of the graph."
            />
            <HowStep
              n="03"
              title="Rank, explain & predict conditions"
              text="Time, walking, transfers and fare are combined, and each bus leg is annotated with predicted occupancy and traffic congestion. Explanations only restate computed facts — the AI never invents buses or stops."
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function Feature({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof RouteIcon;
  title: string;
  text: string;
}) {
  return (
    <li className="group rounded-2xl border bg-card p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-gold/40 hover:shadow-card">
      <span className="flex size-9 items-center justify-center rounded-xl bg-gold/15 text-gold-foreground transition-transform duration-300 group-hover:scale-110">
        <Icon className="size-4" />
      </span>
      <div className="mt-2.5 font-display text-sm font-bold">{title}</div>
      <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</div>
    </li>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center sm:text-left">
      <div className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{value}</div>
      <div className="mt-0.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </div>
    </div>
  );
}

function HowStep({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="relative text-center md:text-left">
      <span className="relative z-10 inline-flex size-12 items-center justify-center rounded-2xl border border-gold/40 bg-card font-mono text-lg font-bold text-gold-foreground shadow-card">
        {n}
      </span>
      <h3 className="mt-4 font-display text-xl font-bold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}
