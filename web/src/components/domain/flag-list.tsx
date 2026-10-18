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
  const facts = [
    flag.expected ? { label: "Expected", value: flag.expected, tone: "text-fg" } : null,
    flag.stated ? { label: "Stated", value: flag.stated, tone: "text-fg" } : null,
    flag.variance_pct !== null
      ? { label: "Difference", value: formatVariance(flag.variance_pct), tone: flag.severity === "high" ? "font-medium text-risk-high" : "text-fg" }
      : null,
  ].filter((f) => f !== null);
  return (
    <article className={cn("grid gap-2", className)}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <SeverityTag severity={flag.severity} />
        <Heading className="text-body font-semibold text-fg">{rule.name}</Heading>
        <span className="text-small text-fg-subtle">{flag.line_id ? `Line ${flag.line_id}` : "Whole invoice"}</span>
      </header>
      <p className="max-w-prose text-body leading-relaxed text-fg-muted [text-wrap:pretty]">{flag.reason}</p>
      {!compact && facts.length ? (
        <dl className="mt-1 flex flex-wrap gap-x-8 gap-y-2">
          {facts.map((f) => (
            <div key={f.label} className="grid max-w-xs content-start gap-0.5">
              <dt className="text-small text-fg-subtle">{f.label}</dt>
              <dd className={cn("text-body tabular", f.tone)}>{f.value}</dd>
            </div>
          ))}
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
