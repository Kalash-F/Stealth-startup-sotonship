import { AlertTriangle, CircleDashed, CircleCheck, CircleDot, CheckCircle2, Clock, ArrowUpRight, Circle, Search, ShieldAlert, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { bandLabel, statusLabel } from "@/data/workspace";
import type { CaseStatus, EvidenceClass, PriorityBand, Severity } from "@/data/types";
import { cn } from "@/lib/utils";

/**
 * Status vocabulary. Each status pairs colour with a glyph and a word,
 * so meaning never depends on colour alone.
 */

const bandTone = { review_now: "high", review: "review", low: "low" } as const;
const bandGlyph = { review_now: "▲", review: "■", low: "●" } as const;

export function PriorityBadge({ band, score, className }: { band: PriorityBand; score?: number; className?: string }) {
  return (
    <Badge tone={bandTone[band]} className={className}>
      <span aria-hidden className="text-[9px] leading-none">{bandGlyph[band]}</span>
      {bandLabel[band]}
      {score !== undefined ? <span className="tabular opacity-80">· {score}</span> : null}
    </Badge>
  );
}

/** Large numeric priority used in case headers. */
export function PriorityScore({ band, score }: { band: PriorityBand; score: number }) {
  const color = { review_now: "text-risk-high", review: "text-risk-review", low: "text-risk-low" }[band];
  return (
    <div className="flex items-baseline gap-2 whitespace-nowrap">
      <span className={cn("font-mono text-3xl font-medium tabular leading-none", color)}>{score}</span>
      <span className="font-mono text-xs text-fg-subtle">/ 100</span>
    </div>
  );
}

const severityTone = { high: "high", medium: "review", low: "neutral" } as const;
const severityIcon = { high: ShieldAlert, medium: AlertTriangle, low: Info } as const;

export function SeverityTag({ severity, className }: { severity: Severity; className?: string }) {
  const Icon = severityIcon[severity];
  return (
    <Badge tone={severityTone[severity]} className={className}>
      <Icon aria-hidden className="size-3" />
      {severity}
    </Badge>
  );
}

const statusIcon: Record<CaseStatus, typeof Circle> = {
  new: CircleDot,
  in_review: Search,
  awaiting_info: Clock,
  escalated: ArrowUpRight,
  closed_nfa: CheckCircle2,
};
const statusColor: Record<CaseStatus, string> = {
  new: "text-info",
  in_review: "text-fg",
  awaiting_info: "text-risk-review",
  escalated: "text-risk-high",
  closed_nfa: "text-fg-subtle",
};

/** Case status: icon + label in body text, not a badge, to keep tables calm. */
export function CaseStatusLabel({ status, className }: { status: CaseStatus; className?: string }) {
  const Icon = statusIcon[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]", statusColor[status], className)}>
      <Icon aria-hidden className="size-3.5" />
      {statusLabel[status]}
    </span>
  );
}

export const evidenceClassMeta: Record<EvidenceClass, { label: string; tone: "review" | "high" | "finding"; definition: string }> = {
  anomaly: {
    label: "Anomaly",
    tone: "review",
    definition: "Something unusual that merits examination. Not evidence of wrongdoing on its own.",
  },
  indicator: {
    label: "Risk indicator",
    tone: "high",
    definition: "Evidence that may increase concern, judged in context with other evidence.",
  },
  finding: {
    label: "Confirmed finding",
    tone: "finding",
    definition: "A fact established through an appropriate investigative step, such as a registry check.",
  },
};

export function EvidenceClassTag({ value, className }: { value: EvidenceClass; className?: string }) {
  const meta = evidenceClassMeta[value];
  const Glyph = { anomaly: CircleDashed, indicator: CircleDot, finding: CircleCheck }[value];
  return (
    <Badge tone={meta.tone} className={className} title={meta.definition}>
      <Glyph aria-hidden className="size-3" />
      {meta.label}
    </Badge>
  );
}
