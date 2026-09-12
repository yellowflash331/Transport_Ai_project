import { useState } from "react";
import {
  Terminal,
  Play,
  CheckCircle2,
  AlertCircle,
  Database,
  Code2,
  Sparkles,
  Layers,
  X,
} from "lucide-react";
import { executePrologQueryServer } from "@/lib/prolog/prolog.functions";
import type { PrologQueryResult } from "@/lib/prolog/types";
import { cn } from "@/lib/utils";

const PRESET_QUERIES = [
  {
    label: "Direct lines (Insein → Sule)",
    query: "direct_bus(insein, sule, RId, RNum, RName, Hops)",
    desc: "Deduces all direct lines connecting Insein to Sule with hop counts.",
  },
  {
    label: "1-Transfer routes (Insein → Botahtaung)",
    query: "transfer_bus(insein, botahtaung, Transfer, R1, R2, H1, H2, Total)",
    desc: "Deduces optimal transfer stations and lines connecting Insein to Botahtaung.",
  },
  {
    label: "Transfer Hub certification (Sule)",
    query: "is_transfer_hub(sule)",
    desc: "Proves whether Sule is a multi-line transit hub.",
  },
  {
    label: "All lines at Hledan hub",
    query: "hub_routes(hledan, Routes)",
    desc: "Deduces all transit lines intersecting at Hledan.",
  },
  {
    label: "Stop sequence validity proof",
    query: "valid_stop_sequence('21', [insein, hledan, sule])",
    desc: "Proves monotonic forward ordering on Line 21.",
  },
  {
    label: "Flat-fare rule deduction",
    query: "rule_fare_compliance(2, 800, Status, Msg)",
    desc: "Audits 2-bus fare against 400 MMK/leg flat fare rule.",
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function PrologConsoleDialog({ open, onClose }: Props) {
  const [query, setQuery] = useState(PRESET_QUERIES[0].query);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PrologQueryResult | null>(null);

  if (!open) return null;

  const handleRun = async (q = query) => {
    setLoading(true);
    try {
      const res = await executePrologQueryServer({ data: { query: q } });
      setResult(res);
    } catch (err: unknown) {
      setResult({
        query: q,
        success: false,
        solutionsCount: 0,
        bindings: [],
        executionTimeMs: 0,
        error: err instanceof Error ? err.message : "Execution failed",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="flex h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-emerald-500/30 bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 bg-emerald-500/5 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <Terminal className="size-4" />
            </span>
            <div>
              <h2 className="font-display text-base font-bold flex items-center gap-2">
                Prolog Logic Engine Console
                <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  SWI-Prolog
                </span>
              </h2>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Database className="size-3 text-emerald-600 dark:text-emerald-400" />
                <span>14,503 Transit Facts · 12 Deduction Rules Active</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5 space-y-4">
          {/* Presets */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
              <Sparkles className="size-3 text-gold" /> Preset Transit Goals
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_QUERIES.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setQuery(preset.query);
                    handleRun(preset.query);
                  }}
                  className="rounded-xl border border-border/70 p-2.5 text-left hover:border-emerald-500/40 hover:bg-emerald-500/5 transition text-xs"
                >
                  <div className="font-semibold text-foreground">{preset.label}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{preset.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Query Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Code2 className="size-3" /> Prolog Goal Query
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">e.g. direct_bus(insein, sule, R, N, Name, Hops)</span>
            </label>
            <div className="relative">
              <div className="absolute left-3 top-3 font-mono text-emerald-600 dark:text-emerald-400 font-bold select-none text-sm">
                ?-
              </div>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-border/80 bg-background pl-8 pr-24 py-2.5 font-mono text-xs focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 resize-none"
                placeholder="Enter Prolog goal..."
              />
              <button
                type="button"
                onClick={() => handleRun()}
                disabled={loading || !query.trim()}
                className="absolute right-2.5 top-2.5 flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 disabled:opacity-50 transition"
              >
                <Play className="size-3 fill-current" />
                <span>{loading ? "Solving…" : "Run"}</span>
              </button>
            </div>
          </div>

          {/* Results Output */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Layers className="size-3" /> Prolog Unification & Solutions
              </span>
              {result && (
                <span className="font-mono text-[10px] lowercase">
                  {result.solutionsCount} solution{result.solutionsCount === 1 ? "" : "s"} · {result.executionTimeMs}ms
                </span>
              )}
            </div>

            <div className="rounded-2xl border border-border/80 bg-background/90 p-4 font-mono text-xs min-h-[160px] overflow-x-auto shadow-inner">
              {loading ? (
                <div className="flex h-32 items-center justify-center gap-2 text-muted-foreground">
                  <div className="size-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                  <span>Deducing with SWI-Prolog backward chaining…</span>
                </div>
              ) : result ? (
                result.success ? (
                  result.solutionsCount === 0 ? (
                    <div className="text-amber-500 flex items-center gap-2">
                      <AlertCircle className="size-4" />
                      <span>Goal failed: false. (No solutions satisfy the goal)</span>
                    </div>
                  ) : result.bindings.length === 1 && Object.keys(result.bindings[0]).length === 0 ? (
                    <div className="text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                      <CheckCircle2 className="size-4" />
                      <span>Goal succeeded: true. (Deterministic proof satisfied)</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-emerald-600 dark:text-emerald-400 flex items-center gap-2 font-semibold">
                        <CheckCircle2 className="size-4" />
                        <span>Found {result.solutionsCount} unified solution{result.solutionsCount === 1 ? "" : "s"}:</span>
                      </div>
                      <div className="space-y-2">
                        {result.bindings.map((b, idx) => (
                          <div
                            key={idx}
                            className="rounded-lg border border-border/60 bg-muted/40 p-2.5 text-xs text-foreground space-y-1"
                          >
                            <div className="text-[10px] font-bold text-muted-foreground uppercase">
                              Solution #{idx + 1}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {Object.entries(b).map(([k, v]) => (
                                <div key={k} className="truncate">
                                  <span className="font-bold text-emerald-700 dark:text-emerald-400">{k}</span> ={" "}
                                  <span className="text-foreground">{JSON.stringify(v)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                ) : (
                  <div className="text-rose-500 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertCircle className="size-4" /> Prolog Exception:
                    </div>
                    <pre className="text-[11px] whitespace-pre-wrap">{result.error}</pre>
                  </div>
                )
              ) : (
                <div className="text-muted-foreground/70 italic flex h-32 items-center justify-center">
                  Select a preset goal or enter a Prolog query above and click "Run" to view live unification bindings.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/80 bg-muted/20 px-5 py-3 text-xs text-muted-foreground">
          <span>Knowledge base: <code className="font-mono text-[11px]">bus_routes.pl</code></span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-secondary px-3 py-1.5 font-medium text-secondary-foreground hover:bg-secondary/80 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
