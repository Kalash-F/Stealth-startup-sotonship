import { PriorityBadge } from "@/components/domain/status";
import { CaseStatusLabel } from "@/components/domain/status";
import { attentionQueue, caseCounts, flagsByRule, screeningSeries } from "@/data";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { ProductFrame } from "./primitives";

/**
 * Static overview preview built from the same aggregate functions as the
 * /app overview. Kept self-contained so it can later be swapped for the
 * app's real widgets.
 */
export function OverviewPreview() {
  const counts = caseCounts();
  const queue = attentionQueue().slice(0, 8);
  const rules = flagsByRule().slice(0, 6);
  const maxRule = Math.max(...rules.map((r) => r.total));
  const maxFlagged = Math.max(...screeningSeries.map((s) => s.flagged));
  const dist = [
    { label: "Review now", n: counts.reviewNow, cls: "bg-risk-high", glyph: "▲" },
    { label: "Review", n: counts.review, cls: "bg-risk-review", glyph: "■" },
    { label: "Low", n: counts.low, cls: "bg-risk-low", glyph: "●" },
  ];

  return (
    <ProductFrame
      label="Product preview of the overview dashboard, fictional sample data"
      crumbs={["Trade Finance Investigations", "Overview"]}
      right={<span className="font-mono text-2xs uppercase tracking-[0.06em] text-fg-subtle">Fictional data</span>}
      bodyClassName="grid lg:grid-cols-12"
    >
      {/* attention queue */}
      <div className="min-w-0 border-b border-border lg:col-span-7 lg:border-b-0 lg:border-r">
        <div className="flex items-baseline justify-between px-5 py-4">
          <h3 className="text-[13px] font-semibold">Needs attention</h3>
          <p className="font-mono text-2xs text-fg-subtle tabular">{counts.open} open cases</p>
        </div>
        <ul className="divide-y divide-border border-t border-border">
          {queue.map((c) => (
            <li key={c.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-3 sm:grid-cols-[5.5rem_1fr_auto_auto]">
              <span className="font-mono text-xs text-fg-muted">{c.id}</span>
              <span className="col-span-2 min-w-0 truncate text-[13px] text-fg sm:col-span-1 sm:col-start-2 sm:row-start-1">{c.title}</span>
              <span className="hidden sm:block">
                <CaseStatusLabel status={c.status} className="text-xs" />
              </span>
              <span className="col-start-2 row-start-1 justify-self-end sm:col-start-4">
                <PriorityBadge band={c.priority_band} score={c.priority_score} />
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* right column */}
      <div className="min-w-0 divide-y divide-border lg:col-span-5">
        <div className="p-5">
          <h3 className="text-[13px] font-semibold">Priority distribution</h3>
          <div className="mt-4 flex h-3 gap-0.5" role="img" aria-label={dist.map((d) => `${d.label} ${d.n}`).join(", ")}>
            {dist.map((d) => (
              <div key={d.label} className={cn(d.cls)} style={{ flex: d.n }} />
            ))}
          </div>
          <ul className="mt-3 grid grid-cols-3 gap-2 text-xs text-fg-muted">
            {dist.map((d) => (
              <li key={d.label}>
                <span aria-hidden className="mr-1 text-[9px]">{d.glyph}</span>
                {d.label}
                <span className="block font-mono text-lg text-fg tabular">{d.n}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-5">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[13px] font-semibold">Screening trend</h3>
            <p className="font-mono text-2xs text-fg-subtle">Flagged invoices · synthetic</p>
          </div>
          <ul className="mt-4 grid h-28 grid-cols-6 items-end gap-2" aria-label="Flagged invoices per month">
            {screeningSeries.map((s) => {
              const partial = "partial" in s && s.partial;
              return (
                <li key={s.month} className="flex h-full flex-col items-stretch justify-end gap-1.5">
                  <span className="text-center font-mono text-2xs text-fg-muted tabular">{s.flagged}</span>
                  <div
                    className={cn("bg-accent/80", partial && "border border-dashed border-accent bg-transparent")}
                    style={{ height: `${(s.flagged / maxFlagged) * 100}%` }}
                    title={`${s.month}: ${formatNumber(s.screened)} screened, ${s.flagged} flagged`}
                  />
                </li>
              );
            })}
          </ul>
          <ul className="mt-1.5 grid grid-cols-6 gap-2 text-center font-mono text-2xs text-fg-subtle">
            {screeningSeries.map((s) => (
              <li key={s.month}>{s.month}{"partial" in s && s.partial ? "*" : ""}</li>
            ))}
          </ul>
          <p className="mt-2 font-mono text-2xs text-fg-subtle">* October to date</p>
        </div>

        <div className="p-5">
          <h3 className="text-[13px] font-semibold">Flags by rule</h3>
          <ul className="mt-3 space-y-2">
            {rules.map((r) => (
              <li key={r.rule} className="grid grid-cols-[6rem_1fr_1.5rem] items-center gap-3 text-xs">
                <span className="truncate text-fg-muted">{r.label}</span>
                <span className="h-1.5 bg-surface-2">
                  <span className="block h-full bg-fg-muted" style={{ width: `${(r.total / maxRule) * 100}%` }} />
                </span>
                <span className="text-right font-mono text-fg tabular">{r.total}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ProductFrame>
  );
}

