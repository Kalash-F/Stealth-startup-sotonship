import { rules } from "@/data/reference";
import type { Flag } from "@/data/types";
import { formatVariance } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SeverityTag } from "./status";

const severityOrder = { high: 0, medium: 1, low: 2 } as const;

export function sortFlags(flags: Flag[]) {
  return [...flags].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

/** One explained flag: what rule fired, why, and the numbers behind it. */
export function FlagItem({
  flag,
  compact = false,
  className,
  headingLevel: Heading = "h4",
}: {
  flag: Flag;
  compact?: boolean;
  className?: string;
  headingLevel?: "h3" | "h4";
}) {
  const rule = rules[flag.rule];
  return (
    <article className={cn("grid gap-2", className)}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <SeverityTag severity={flag.severity} />
        <Heading className="text-[13px] font-semibold text-fg">{rule.name}</Heading>
        <span className="font-mono text-2xs text-fg-subtle">
          {flag.line_id ? `Line ${flag.line_id}` : "Invoice level"} · {flag.rule}
        </span>
      </header>
      <p className="text-[13px] leading-relaxed text-fg-muted">{flag.reason}</p>
      {!compact && (flag.expected || flag.stated) ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs tabular sm:grid-cols-[auto_1fr_auto_1fr_auto_1fr]">
          {flag.expected ? (
            <>
              <dt className="text-fg-subtle">Expected</dt>
              <dd className="text-fg">{flag.expected}</dd>
            </>
          ) : null}
          {flag.stated ? (
            <>
              <dt className="text-fg-subtle">Stated</dt>
              <dd className="text-fg">{flag.stated}</dd>
            </>
          ) : null}
          {flag.variance_pct !== null ? (
            <>
              <dt className="text-fg-subtle">Variance</dt>
              <dd className={flag.severity === "high" ? "text-risk-high" : "text-risk-review"}>{formatVariance(flag.variance_pct)}</dd>
            </>
          ) : null}
        </dl>
      ) : null}
    </article>
  );
}

export function FlagList({
  flags,
  compact = false,
  className,
  headingLevel,
}: {
  flags: Flag[];
  compact?: boolean;
  className?: string;
  headingLevel?: "h3" | "h4";
}) {
  return (
    <ol className={cn("divide-y divide-border", className)}>
      {sortFlags(flags).map((f) => (
        <li key={f.flag_id} className="py-3 first:pt-0 last:pb-0">
          <FlagItem flag={f} compact={compact} headingLevel={headingLevel} />
        </li>
      ))}
    </ol>
  );
}
