import { useState } from "react";
import { BrainCircuit, ChevronDown, Cpu, TrendingUp } from "lucide-react";
import type { Journey } from "@/lib/transit/types";
import type { Recommendation } from "@/lib/ai/recommender";
import { cn } from "@/lib/utils";

interface Props {
  ai: Recommendation;
  journeys: Journey[];
  selectedId: string;
  onSelect: (id: string) => void;
  timeLabel: string;
  currency: string;
}

export function AIRecommendationCard({ ai, journeys, selectedId, onSelect, timeLabel, currency }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const best = ai.best;
  const bestJourney = best ? journeys.find((j) => j.id === best.journeyId) : undefined;
  if (!best || !bestJourney) return null;
  const busNumbers = bestJourney.legs.filter((l) => l.kind === "bus").map((l) => (l.kind === "bus" ? l.routeNumber : ""));

  return (
    <section className="overflow-hidden rounded-2xl ink-panel shadow-card animate-rise" aria-labelledby="ai-rec-title">
      <div className="flex items-center justify-between gap-2 border-b border-ink-foreground/10 px-4 py-3">
        <h2 id="ai-rec-title" className="flex items-center gap-2 font-display text-base font-bold">
          <span className="flex size-7 items-center justify-center rounded-lg bg-gold text-gold-foreground">
            <BrainCircuit className="size-4" />
          </span>
          AI Recommendation
        </h2>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide uppercase",
            ai.model.isDemo ? "bg-warning/25 text-warning" : "bg-success/25 text-success",
          )}
          title={`Model: ${ai.model.name} v${ai.model.version}`}
        >
          {ai.model.isDemo ? "Demo model" : "ML model"} · {ai.model.version}
        </span>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">Best route</div>
            <div className="mt-0.5 font-display text-2xl font-bold">
              Route {best.journeyId.replace("route-", "")}
              <span className="ml-2 font-mono text-sm font-medium text-ink-muted">{busNumbers.join(" → ")}</span>
            </div>
          </div>
          <ScoreRing score={best.score} />
        </div>

        <p className="mt-3 text-sm leading-relaxed text-ink-foreground/90">{ai.summary}</p>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <Metric label="Predicted time" value={`${best.prediction.predictedTotalMinutes} min`} sub={`${best.prediction.lowerMinutes}–${best.prediction.upperMinutes} min`} />
          <Metric
            label="vs historical"
            value={`${best.prediction.deltaMinutes >= 0 ? "+" : ""}${best.prediction.deltaMinutes} min`}
            sub={`${bestJourney.totalMinutes} min scheduled`}
          />
          <Metric label="Confidence" value={`${Math.round(best.prediction.confidence * 100)}%`} sub={timeLabel} />
        </div>

        <ul className="mt-3 space-y-1 text-sm">
          {best.reasons.map((r, i) => (
            <li key={i} className="flex gap-2 text-ink-foreground/85">
              <TrendingUp className="mt-0.5 size-3.5 shrink-0 text-gold" />
              <span>{r}</span>
            </li>
          ))}
        </ul>

        {ai.alternatives.length > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">All valid routes, scored</div>
            <ol className="space-y-1.5">
              {ai.ranked.map((r) => {
                const j = journeys.find((x) => x.id === r.journeyId);
                if (!j) return null;
                const sel = r.journeyId === selectedId;
                return (
                  <li key={r.journeyId}>
                    <button
                      type="button"
                      onClick={() => onSelect(r.journeyId)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-xs transition",
                        sel ? "border-gold bg-ink-foreground/10" : "border-ink-foreground/10 hover:bg-ink-foreground/5",
                      )}
                    >
                      <span className="w-14 shrink-0 font-semibold">Route {r.journeyId.replace("route-", "")}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-foreground/10">
                        <span className="block h-full rounded-full bg-gold" style={{ width: `${r.score}%` }} />
                      </span>
                      <span className="w-10 text-right font-mono font-semibold">{r.score}</span>
                      <span className="w-16 text-right text-ink-muted">{r.prediction.predictedTotalMinutes} min</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowDetails((s) => !s)}
          className="mt-4 flex w-full items-center justify-between rounded-lg border border-ink-foreground/10 px-3 py-2 text-xs text-ink-muted hover:bg-ink-foreground/5"
        >
          <span className="flex items-center gap-1.5">
            <Cpu className="size-3.5" /> How the AI decided
          </span>
          <ChevronDown className={cn("size-3.5 transition", showDetails && "rotate-180")} />
        </button>
        {showDetails && (
          <div className="mt-2 space-y-2 rounded-lg bg-ink-foreground/5 p-3 text-xs text-ink-foreground/85">
            <p>
              <strong>1. Route engine</strong> (deterministic Dijkstra) produced {journeys.length} valid route
              {journeys.length === 1 ? "" : "s"}. The AI can only choose among these.
            </p>
            <p>
              <strong>2. Travel-time predictor</strong> <span className="font-mono">{ai.model.name}</span> re-estimated each stop-to-stop hop
              using: {ai.model.features.join(", ")}. Traffic feed: {ai.context.trafficAvailable ? "connected" : "not connected (null)"}.
            </p>
            <p>
              <strong>3. Recommender</strong> normalised predicted time, walking, transfers and fare ({currency}) across the routes and
              weighted them for “{ai.context.preference.replace("_", " ")}”: time {pct(ai.weights.time)}, walking {pct(ai.weights.walking)},
              transfers {pct(ai.weights.transfers)}, fare {pct(ai.weights.fare)}.
            </p>
            {ai.model.isDemo && (
              <p className="text-warning">
                Demo predictor: rule-based multipliers stand in for a trained model. Export features at{" "}
                <a className="underline" href="/api/ml/training-data" target="_blank" rel="noreferrer">
                  /api/ml/training-data
                </a>{" "}
                to train a Random Forest / XGBoost model, then point ML_PREDICTOR_URL at it.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg bg-ink-foreground/5 px-2 py-2">
      <div className="text-[10px] tracking-wider text-ink-muted uppercase">{label}</div>
      <div className="mt-0.5 font-display text-base font-bold">{value}</div>
      <div className="text-[10px] text-ink-muted">{sub}</div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-16 shrink-0" title="Recommendation score (0–100)">
      <svg viewBox="0 0 56 56" className="size-16 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="5" className="stroke-ink-foreground/10" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          className="stroke-gold transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-lg leading-none font-bold">{score}</span>
        <span className="text-[9px] text-ink-muted">score</span>
      </div>
    </div>
  );
}
