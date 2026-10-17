import Link from "next/link";
import { ArrowRight, CalendarClock } from "lucide-react";
import { CaseStatusLabel, PriorityBadge } from "@/components/domain/status";
import { Button } from "@/components/ui/button";
import { investigationById, featuredCaseId } from "@/data/investigations";
import { dueLabel, fundsFlowForCase } from "@/data/selectors";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The case the workspace is built around, with its next action and money trail. */
export function FeaturedCase({ className }: { className?: string }) {
  const c = investigationById(featuredCaseId)!;
  const flow = fundsFlowForCase(c);
  const manufacturer = flow?.recipients.find((r) => r.entity.kind === "manufacturer");
  const related = flow?.recipients.find((r) => r.entity.kind !== "manufacturer");

  const figures = [
    { label: "Invoiced to importer", value: c.invoice.stated_total, tone: "text-fg" },
    related ? { label: "Forwarded to related party", value: related.amount, tone: "text-risk-high" } : null,
    manufacturer ? { label: "Paid to manufacturer", value: manufacturer.amount, tone: "text-fg" } : null,
  ].filter(Boolean) as { label: string; value: number; tone: string }[];

  return (
    <section aria-labelledby="featured-heading" className={cn("flex flex-col rounded-md border border-accent/45 bg-surface", className)}>
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="eyebrow !text-accent">Your case · next up</p>
        <span className="font-mono text-[12px] text-fg-muted">{c.id}</span>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div>
          <h2 id="featured-heading" className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-fg">
            {c.title}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <PriorityBadge band={c.priority_band} score={c.priority_score} />
            <CaseStatusLabel status={c.status} />
            <span className="font-mono text-[11.5px] text-fg-subtle">{c.route}</span>
          </div>
        </div>

        <dl className="grid gap-px overflow-hidden rounded-sm border border-border bg-border">
          {figures.map((f) => (
            <div key={f.label} className="flex items-baseline justify-between gap-3 bg-surface px-3 py-2">
              <dt className="truncate text-[12px] text-fg-muted">{f.label}</dt>
              <dd className={cn("whitespace-nowrap font-mono text-[13px] tabular", f.tone)}>{formatMoney(f.value)}</dd>
            </div>
          ))}
        </dl>

        <div className="rounded-sm border-l-2 border-accent bg-surface-2 px-3 py-2.5">
          <p className="eyebrow">Next action</p>
          <p className="mt-1 text-[13px] leading-snug text-fg">{c.nextAction.label}</p>
          {c.nextAction.due ? (
            <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[11.5px] tabular text-risk-review">
              <CalendarClock className="size-3.5" aria-hidden />
              {formatDate(c.nextAction.due)} · {dueLabel(c.nextAction.due)}
            </p>
          ) : null}
        </div>

        <Button asChild variant="accent" size="sm" className="mt-auto self-start">
          <Link href={`/app/investigations/${c.id}`}>
            Open case <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </section>
  );
}
