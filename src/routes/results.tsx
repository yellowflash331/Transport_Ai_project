import { lazy, Suspense, useEffect, useState } from "react";
import { createFileRoute, Link, ClientOnly } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { BusFront, ChevronLeft, Clock, Coins, Footprints, Repeat, SlidersHorizontal } from "lucide-react";
import { planJourney } from "@/lib/ai/ai.functions";
import { AIRecommendationCard } from "@/components/transit/AIRecommendationCard";
import { JourneyCard } from "@/components/transit/JourneyCard";
import { JourneySteps } from "@/components/transit/JourneySteps";
import { JourneyFlowSummary } from "@/components/transit/JourneyFlowSummary";
import { SearchForm } from "@/components/transit/SearchForm";
import { PrologAuditCard } from "@/components/transit/PrologAuditCard";
import { cn } from "@/lib/utils";

const RouteMap = lazy(() => import("@/components/transit/RouteMap"));

const searchSchema = z.object({
  from: z.string().default(""),
  fromLat: z.coerce.number().default(0),
  fromLng: z.coerce.number().default(0),
  to: z.string().default(""),
  toLat: z.coerce.number().default(0),
  toLng: z.coerce.number().default(0),
});
type SearchParams = z.infer<typeof searchSchema>;

const routesQuery = (s: SearchParams) =>
  queryOptions({
    queryKey: ["plan", s],
    queryFn: () =>
      planJourney({
        data: {
          origin: { name: s.from, lat: s.fromLat, lng: s.fromLng, kind: "place" },
          destination: { name: s.to, lat: s.toLat, lng: s.toLng, kind: "place" },
          preference: "recommended",
        },
      }),
    staleTime: 5 * 60_000,
  });

export const Route = createFileRoute("/results")({
  validateSearch: (raw) => searchSchema.parse(raw),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    if (!deps.from || !deps.to) return null;
    return context.queryClient.ensureQueryData(routesQuery(deps));
  },
  head: ({ match }) => {
    const s = match.search;
    const title = s.from && s.to ? `${s.from} → ${s.to} · TransitAI` : "Route results · TransitAI";
    const desc = `Top bus routes from ${s.from || "your start"} to ${s.to || "your destination"} in Yangon with transfers, walking distance, time and fare.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  pendingComponent: Pending,
  errorComponent: ({ error }) => (
    <Shell>
      <div role="alert" className="mx-auto max-w-lg rounded-2xl border bg-card p-6 text-center">
        <h1 className="font-display text-xl font-bold">Couldn't compute routes</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Link to="/" className="mt-4 inline-block text-sm font-semibold underline">
          Back to search
        </Link>
      </div>
    </Shell>
  ),
  notFoundComponent: () => (
    <Shell>
      <p className="text-center text-muted-foreground">No routes found.</p>
    </Shell>
  ),
  component: ResultsPage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <div className="p-5">{children}</div>
    </div>
  );
}

function TopBar() {
  return (
    <header className="flex h-14 items-center gap-3 border-b bg-card px-4">
      <Link to="/" className="flex items-center gap-2 font-display text-base font-bold">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <BusFront className="size-3.5" />
        </span>
        TransitAI
      </Link>
    </header>
  );
}

function Pending() {
  return (
    <Shell>
      <div className="mx-auto mt-16 max-w-sm text-center">
        <div className="mx-auto size-10 animate-spin rounded-full border-4 border-muted border-t-gold" />
        <p className="mt-4 font-display font-semibold">Searching the bus network…</p>
        <p className="text-sm text-muted-foreground">Finding nearby stops and bus combinations</p>
      </div>
    </Shell>
  );
}

function ResultsPage() {
  const search = Route.useSearch();
  if (!search.from || !search.to) {
    return (
      <Shell>
        <div className="mx-auto max-w-2xl rounded-3xl border bg-card p-6 shadow-card">
          <h1 className="mb-4 font-display text-xl font-bold">Plan a journey</h1>
          <SearchForm />
        </div>
      </Shell>
    );
  }
  return <Results search={search} />;
}

function Results({ search }: { search: SearchParams }) {
  const { data } = useSuspenseQuery(routesQuery(search));
  const initialId = data.ai.best?.journeyId ?? data.journeys[0]?.id ?? "";
  const [selectedId, setSelectedId] = useState(initialId);
  const [editing, setEditing] = useState(false);
  useEffect(() => setSelectedId(data.ai.best?.journeyId ?? data.journeys[0]?.id ?? ""), [data]);
  const selected = data.journeys.find((j) => j.id === selectedId) ?? data.journeys[0];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4">
        <Link to="/" className="flex items-center gap-2 font-display text-base font-bold" aria-label="TransitAI home">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <BusFront className="size-3.5" />
          </span>
          <span className="hidden sm:inline">TransitAI</span>
        </Link>
        <div className="mx-2 hidden h-6 w-px bg-border sm:block" />
        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <span className="size-2.5 shrink-0 rounded-full bg-success" />
          <span className="truncate font-medium">{data.origin.name}</span>
          <span className="text-muted-foreground">→</span>
          <span className="size-2.5 shrink-0 rounded-full bg-route-1" />
          <span className="truncate font-medium">{data.destination.name}</span>
        </div>
        <button
          onClick={() => setEditing((e) => !e)}
          className="flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium hover:bg-accent"
        >
          <SlidersHorizontal className="size-4" />
          <span className="hidden sm:inline">{editing ? "Close" : "Edit search"}</span>
        </button>
      </header>

      {editing && (
        <div className="z-20 border-b bg-card/95 p-4 shadow-card backdrop-blur animate-rise">
          <div className="mx-auto max-w-4xl">
            <SearchForm
              compact
              initial={{
                origin: { name: data.origin.name, lat: data.origin.lat, lng: data.origin.lng, kind: "place" },
                destination: { name: data.destination.name, lat: data.destination.lat, lng: data.destination.lng, kind: "place" },
              }}
            />
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Map */}
        <div className="relative h-[42vh] shrink-0 lg:order-2 lg:h-auto lg:flex-1">
          <ClientOnly fallback={<MapSkeleton />}>
            <Suspense fallback={<MapSkeleton />}>
              <RouteMap
                origin={data.origin}
                destination={data.destination}
                journeys={data.journeys}
                selectedId={selected?.id ?? ""}
                candidateStops={data.candidateStops}
              />
            </Suspense>
          </ClientOnly>
          {data.network.isDemo && (
            <div className="pointer-events-none absolute top-3 left-3 z-[400] rounded-md bg-ink/85 px-2 py-1 text-[11px] font-semibold text-ink-foreground">
              DEMO DATA
            </div>
          )}
        </div>

        {/* Side panel */}
        <aside className="flex min-h-0 flex-1 flex-col overflow-y-auto border-t bg-background lg:order-1 lg:w-[440px] lg:flex-none lg:border-t-0 lg:border-r xl:w-[480px]">
          <div className="space-y-4 p-4">
            {data.journeys.length === 0 ? (
              <div className="rounded-2xl border bg-card p-6 text-center">
                <h2 className="font-display text-lg font-bold">No bus connection found</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  There's no stop within walking distance of one of your locations in the current dataset. Try a place closer to
                  central Yangon.
                </p>
                <Link to="/" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold underline">
                  <ChevronLeft className="size-4" /> Change locations
                </Link>
              </div>
            ) : (
              <>
                <AIRecommendationCard
                  ai={data.ai}
                  journeys={data.journeys}
                  selectedId={selected?.id ?? ""}
                  onSelect={setSelectedId}
                  timeLabel={`Yangon ${data.timeContext.label}`}
                />
                <div className="flex items-end justify-between">
                  <h1 className="font-display text-xl font-bold">Valid routes from the engine</h1>
                </div>
                <div className="space-y-3">
                  {data.journeys.map((j, i) => (
                    <JourneyCard
                      key={j.id}
                      journey={j}
                      rank={i}
                      selected={j.id === selected?.id}
                      currency={data.network.currency}
                      aiScore={data.ai.ranked.find((r) => r.journeyId === j.id)?.score}
                      predictedMinutes={data.ai.ranked.find((r) => r.journeyId === j.id)?.prediction.predictedTotalMinutes}
                      onSelect={() => setSelectedId(j.id)}
                    />
                  ))}
                </div>

                {selected && (
                  <section className="rounded-2xl border bg-card p-5 shadow-xs animate-rise" key={selected.id}>
                    <div className="mb-4 grid grid-cols-4 gap-2 rounded-xl ink-panel p-3 text-center">
                      <Total icon={Clock} value={`${selected.totalMinutes}m`} label="total" />
                      <Total icon={Footprints} value={`${selected.walkMeters}m`} label="walking" />
                      <Total icon={Repeat} value={String(selected.transferCount)} label="transfers" />
                      <Total icon={Coins} value={String(selected.fare)} label={data.network.currency} />
                    </div>

                    {selected.prologAudit && (
                      <div className="mb-4">
                        <PrologAuditCard
                          audit={selected.prologAudit}
                          journeyTitle={`Route ${selected.id.replace("route-", "")}`}
                        />
                      </div>
                    )}

                    <h2 className="mb-2 font-display text-lg font-bold">Step by step</h2>
                    <div className="mb-4">
                      <JourneyFlowSummary journey={selected} />
                    </div>
                    <JourneySteps journey={selected} currency={data.network.currency} />
                  </section>
                )}
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Total({ icon: Icon, value, label }: { icon: typeof Clock; value: string; label: string }) {
  return (
    <div>
      <Icon className={cn("mx-auto size-3.5 text-ink-muted")} />
      <div className="mt-1 font-display text-lg leading-none font-bold">{value}</div>
      <div className="text-[10px] tracking-wide text-ink-muted uppercase">{label}</div>
    </div>
  );
}

function MapSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <div className="text-sm text-muted-foreground">Loading map…</div>
    </div>
  );
}
