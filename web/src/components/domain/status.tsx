import { CircleDashed, CircleCheck, CircleDot, CheckCircle2, Clock, ArrowUpRight, Circle, Search } from "lucide-react";
import { bandLabel, statusLabel } from "@/data/workspace";
import type { CaseStatus, EvidenceClass, PriorityBand, Severity } from "@/data/types";
import { cn } from "@/lib/utils";

/**
 * Status vocabulary: ink first, two priority colours.
 * Review-now priority takes the brick red (`risk-high`) and review priority a yellow of the same
 * weight (`risk-review-mark`); everything else is set in the type colour at different weights. Meaning is always carried by words, numbers or bar length,
 * never by colour alone.
 */

const bandLevel = { review_now: 3, review: 2, low: 1 } as const;
const bandFill = { review_now: "bg-risk-high", review: "bg-risk-review-mark", low: "bg-fg-subtle" } as const;
const bandText = { review_now: "font-medium text-risk-high", review: "font-medium text-risk-review-mark", low: "text-fg-muted" } as const;

/** Three-step priority meter, then the score, then the band. `quiet` drops the colour where the band is context, not an alarm. */
export function PriorityBadge({ band, score, quiet, className }: { band: PriorityBand; score?: number; quiet?: boolean; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-2 whitespace-nowrap text-small", className)}
      title={score !== undefined ? `Priority ${score} of 100` : undefined}
    >
      <span aria-hidden className="flex gap-0.5">
        {[1, 2, 3].map((step) => (
          <span
            key={step}
            className={cn("h-1.5 w-2 rounded-[1px]", step > bandLevel[band] ? "bg-fg/15" : quiet ? "bg-fg-muted" : bandFill[band])}
          />
        ))}
      </span>
      {score !== undefined ? (
        <span className={cn("min-w-[2ch] text-right font-mono font-medium tabular", quiet ? "text-fg" : bandText[band])}>
          {score}
        </span>
      ) : null}
      <span className={cn(quiet ? "text-fg-muted" : bandText[band])}>{bandLabel[band]}</span>
    </span>
  );
}

/**
 * The priority of one case or report, shown once: the score large, the band under it.
 * Headers use this instead of a separate badge, so the number never appears twice.
 */
export function PriorityScore({ band, score, className }: { band: PriorityBand; score: number; className?: string }) {
  const color = { review_now: "text-risk-high", review: "text-fg", low: "text-fg-muted" }[band];
  return (
    <div className={cn("grid justify-items-end gap-1.5 whitespace-nowrap", className)}>
      <p className="flex items-baseline gap-1.5">
        <span className="sr-only">Priority </span>
        <span className={cn("font-mono text-display font-medium tabular leading-none", color)}>{score}</span>
        <span className="font-mono text-small text-fg-subtle">/ 100</span>
      </p>
      <PriorityBadge band={band} />
    </div>
  );
}

const severityColor = { high: "font-semibold text-risk-high", medium: "font-medium text-fg", low: "text-fg-muted" } as const;

/** Flag severity as a word, not a box: brick for high, ink for the rest. */
export function SeverityTag({ severity, className }: { severity: Severity; className?: string }) {
  return <span className={cn("whitespace-nowrap text-small capitalize", severityColor[severity], className)}>{severity}</span>;
}

const statusIcon: Record<Exclude<CaseStatus, "new">, typeof Circle> = {
  in_review: Search,
  awaiting_info: Clock,
  escalated: ArrowUpRight,
  closed_nfa: CheckCircle2,
};
const statusColor: Record<CaseStatus, string> = {
  new: "font-medium text-fg",
  in_review: "text-fg",
  awaiting_info: "text-fg",
  escalated: "text-fg",
  closed_nfa: "text-fg-subtle",
};

/** Case status: icon + label in body text, not a badge, to keep tables calm. New cases get an unread dot. */
export function CaseStatusLabel({ status, className }: { status: CaseStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-body", statusColor[status], className)}>
      {status === "new" ? (
        <span aria-hidden className="flex size-3.5 shrink-0 items-center justify-center">
          <span className="size-1.5 rounded-full bg-current" />
        </span>
      ) : (
        (() => {
          const Icon = statusIcon[status];
          return <Icon aria-hidden className="size-3.5 shrink-0" />;
        })()
      )}
      {statusLabel[status]}
    </span>
  );
}

export const evidenceClassMeta: Record<EvidenceClass, { label: string; definition: string }> = {
  anomaly: {
    label: "Anomaly",
    definition: "Something unusual that merits examination. Not evidence of wrongdoing on its own.",
  },
  indicator: {
    label: "Risk indicator",
    definition: "Evidence that may increase concern, judged in context with other evidence.",
  },
  finding: {
    label: "Confirmed finding",
    definition: "A fact established through an appropriate investigative step, such as a registry check.",
  },
};

const evidenceColor = { anomaly: "text-fg-muted", indicator: "font-medium text-fg", finding: "font-semibold text-risk-high" } as const;

/** How firmly something is established: the glyph fills in as it firms up; only a confirmed finding takes the brick. */
export function EvidenceClassTag({ value, className }: { value: EvidenceClass; className?: string }) {
  const meta = evidenceClassMeta[value];
  const Glyph = { anomaly: CircleDashed, indicator: CircleDot, finding: CircleCheck }[value];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-small", evidenceColor[value], className)} title={meta.definition}>
      <Glyph aria-hidden className="size-3.5 shrink-0" />
      {meta.label}
    </span>
  );
}
