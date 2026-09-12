import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  FileCode2,
  Info,
  AlertTriangle,
  Scale,
  ShieldCheck,
  Zap,
} from "lucide-react";
import type { PrologAudit, PrologRuleResult } from "@/lib/prolog/types";
import { cn } from "@/lib/utils";

interface Props {
  audit?: PrologAudit | undefined;
  journeyTitle?: string | undefined;
}

export function PrologAuditCard({ audit, journeyTitle }: Props) {
  const [showDetails, setShowDetails] = useState(false);

  if (!audit) return null;

  const { isValid, rulesPassedCount, totalRulesCount, rules, advisories, proofSummary, engine, isDemo } = audit;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-emerald-500/30 bg-card shadow-card animate-rise"
      aria-labelledby="prolog-audit-title"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-emerald-500/5 px-4 py-3">
        <h2 id="prolog-audit-title" className="flex items-center gap-2 font-display text-base font-bold">
          <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
            <ShieldCheck className="size-4" />
          </span>
          <span>Prolog Rule Audit</span>
          {journeyTitle && <span className="text-xs font-normal text-muted-foreground">({journeyTitle})</span>}
        </h2>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide uppercase",
            isDemo
              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
              : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30",
          )}
          title={`Engine: ${engine} (bus_routes.pl)`}
        >
          {isDemo ? "Demo Rule Engine" : engine}
        </span>
      </div>

      <div className="p-4">
        {/* Verification Summary Banner */}
        <div className="flex items-start justify-between gap-3 rounded-xl bg-emerald-500/10 p-3 text-sm">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{isValid ? "Path Logically Certified" : "Verified with Advisories"}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Evaluated against declarative transit rules in <code className="font-mono text-[11px]">bus_routes.pl</code>.
            </p>
          </div>
          <div className="text-right">
            <span className="font-mono text-base font-bold text-emerald-700 dark:text-emerald-400">
              {rulesPassedCount}/{totalRulesCount}
            </span>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Rules Passed</div>
          </div>
        </div>

        {/* Rule Items */}
        <div className="mt-3 space-y-2">
          <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Prolog Deductive Rules Checked
          </div>
          <div className="space-y-1.5">
            {rules.map((rule) => (
              <RuleRow key={rule.ruleId} rule={rule} />
            ))}
          </div>
        </div>

        {/* Expandable Prolog Proof Trace */}
        <button
          type="button"
          onClick={() => setShowDetails((s) => !s)}
          className="mt-3.5 flex w-full items-center justify-between rounded-lg border border-border/80 px-3 py-2 text-xs text-muted-foreground hover:bg-accent/40 transition"
        >
          <span className="flex items-center gap-1.5 font-medium">
            <FileCode2 className="size-3.5 text-emerald-600 dark:text-emerald-400" /> View Prolog Proof & Logic Resolution
          </span>
          <ChevronDown className={cn("size-3.5 transition", showDetails && "rotate-180")} />
        </button>

        {showDetails && (
          <div className="mt-2 space-y-2.5 rounded-lg bg-muted/40 p-3 text-xs">
            <div>
              <div className="font-mono text-[11px] font-semibold text-muted-foreground mb-1">
                Prolog Resolution Trace:
              </div>
              <pre className="overflow-x-auto rounded bg-background/90 p-2.5 font-mono text-[11px] leading-relaxed text-foreground border border-border/60">
                {proofSummary}
              </pre>
            </div>
            <div className="text-muted-foreground space-y-1">
              <p>
                <strong>Knowledge Base:</strong> <code className="font-mono text-[11px]">prolog-service/bus_routes.pl</code>
              </p>
              <p>
                <strong>Rules Executed:</strong> <code className="font-mono text-[11px]">direct_connection/4</code>,{" "}
                <code className="font-mono text-[11px]">transfer_connection/6</code>,{" "}
                <code className="font-mono text-[11px]">rule_acyclic_path/3</code>,{" "}
                <code className="font-mono text-[11px]">rule_fare_compliance/4</code>,{" "}
                <code className="font-mono text-[11px]">rule_pedestrian_comfort/3</code>.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function RuleRow({ rule }: { rule: PrologRuleResult }) {
  const isPass = rule.status === "pass";
  const isWarning = rule.status === "warning";
  const isCaution = rule.status === "caution";

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border p-2 text-xs transition",
        isPass
          ? "border-emerald-500/20 bg-emerald-500/5"
          : isWarning
            ? "border-rose-500/20 bg-rose-500/5"
            : "border-amber-500/20 bg-amber-500/5",
      )}
    >
      <div className="mt-0.5 shrink-0">
        {isPass ? (
          <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
        ) : isWarning ? (
          <AlertTriangle className="size-3.5 text-rose-500" />
        ) : (
          <Info className="size-3.5 text-amber-500" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">{rule.ruleName}</span>
          <span className="rounded px-1.5 py-0.2 font-mono text-[9px] uppercase tracking-wide bg-background text-muted-foreground border border-border/50">
            {rule.category}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{rule.message}</p>
      </div>
    </div>
  );
}

