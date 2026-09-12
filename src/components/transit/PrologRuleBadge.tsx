import { CheckCircle2, ShieldCheck, AlertTriangle, HelpCircle } from "lucide-react";
import type { PrologAudit } from "@/lib/prolog/types";
import { cn } from "@/lib/utils";

interface Props {
  audit?: PrologAudit | undefined;
  compact?: boolean;
}

export function PrologRuleBadge({ audit, compact = false }: Props) {
  if (!audit) return null;

  const { isValid, rulesPassedCount, totalRulesCount, isDemo } = audit;

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-tight transition",
          isValid
            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
            : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30",
        )}
        title={`Prolog Logic Rules Audit: ${rulesPassedCount}/${totalRulesCount} rules verified (${audit.engine})`}
      >
        <ShieldCheck className="size-3 shrink-0" />
        <span>Prolog {rulesPassedCount}/{totalRulesCount}</span>
      </span>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border shadow-xs transition",
        isValid
          ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
          : "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800",
      )}
    >
      {isValid ? (
        <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400" />
      )}
      <span className="font-semibold">
        {isValid ? "Prolog Verified" : "Prolog Advisory"}
      </span>
      <span className="text-[11px] opacity-75">
        ({rulesPassedCount}/{totalRulesCount} rules)
      </span>
      {isDemo && (
        <span className="ml-1 rounded bg-amber-200/60 dark:bg-amber-800/60 px-1 text-[9px] font-bold text-amber-900 dark:text-amber-200">
          DEMO
        </span>
      )}
    </div>
  );
}

