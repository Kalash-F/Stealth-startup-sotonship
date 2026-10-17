import Link from "next/link";
import { ArrowUpRight, Clock, FolderSearch, ShieldAlert } from "lucide-react";
import { investigations } from "@/data/investigations";
import { caseCounts } from "@/data/workspace";
import { cn } from "@/lib/utils";

/**
 * Four headline counts in one ruled strip. The open-cases tile also carries
 * the priority distribution, which answers "how much of the queue is urgent?".
 */
export function KpiStrip() {
  const c = caseCounts();
  const segments = [
    { key: "review_now", label: "Review now", glyph: "▲", count: c.reviewNow, color: "var(--risk-high)" },
    { key: "review", label: "Review", glyph: "■", count: c.review, color: "var(--risk-review)" },
    { key: "low", label: "Low", glyph: "●", count: c.low, color: "var(--risk-low)" },
  ];

  const tiles = [
    {
      label: "Review now",
      value: c.reviewNow,
      icon: ShieldAlert,
      tone: "text-risk-high",
      note: "Open cases scoring 60 or more",
      href: "/app/investigations?band=review_now",
    },
    {
      label: "Awaiting information",
      value: c.awaiting,
      icon: Clock,
      tone: "text-risk-review",
      note: "Requests out to counterparties",
      href: "/app/investigations?status=awaiting_info",
    },
    {
      label: "Escalated",
      value: c.escalated,
      icon: ArrowUpRight,
      tone: "text-risk-high",
      note: "With the MLRO for a decision",
      href: "/app/investigations?status=escalated",
    },
  ];

  return (
    <section aria-labelledby="kpi-heading" className="grid grid-cols-3 overflow-hidden rounded-md border border-border bg-surface xl:grid-cols-[1.6fr_1fr_1fr_1fr]">
      <h2 id="kpi-heading" className="sr-only">
        Case counts
      </h2>
      <div className="col-span-3 border-b border-border p-4 xl:col-span-1 xl:border-b-0 xl:border-r">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[12.5px] text-fg-muted">
            <FolderSearch className="size-3.5 text-fg-subtle" aria-hidden />
            Open cases
          </p>
          <Link href="/app/investigations" className="text-[12px] text-fg-subtle hover:text-fg">
            View all
          </Link>
        </div>
        <p className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-[28px] font-medium leading-none tabular text-fg">{c.open}</span>
          <span className="text-[12px] text-fg-subtle">
            of {investigations.length} in workspace · {c.closed} closed
          </span>
        </p>
        <div className="mt-3 flex h-2 gap-0.5" role="img" aria-label={segments.map((s) => `${s.label} ${s.count}`).join(", ")}>
          {segments.map((s) =>
            s.count ? <span key={s.key} className="h-full first:rounded-l-xs last:rounded-r-xs" style={{ flex: s.count, background: s.color }} /> : null,
          )}
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-fg-muted">
          {segments.map((s) => (
            <li key={s.key} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="text-[9px]" style={{ color: s.color }}>
                {s.glyph}
              </span>
              {s.label}
              <span className="font-mono tabular text-fg">{s.count}</span>
            </li>
          ))}
        </ul>
      </div>
      {tiles.map((t, idx) => {
        const Icon = t.icon;
        return (
          <Link
            key={t.label}
            href={t.href}
            className={cn(
              "group block min-w-0 border-border p-3 transition-colors hover:bg-surface-2 sm:p-4",
              idx < tiles.length - 1 && "border-r",
            )}
          >
            <p className="flex items-start gap-1.5 text-[12px] leading-tight text-fg-muted sm:items-center sm:gap-2 sm:text-[12.5px]">
              <Icon className={cn("size-3.5 shrink-0", t.tone)} aria-hidden />
              {t.label}
            </p>
            <p className="mt-2 font-mono text-[28px] font-medium leading-none tabular text-fg">{t.value}</p>
            <p className="mt-3 hidden text-[11.5px] text-fg-subtle group-hover:text-fg-muted sm:block">{t.note}</p>
          </Link>
        );
      })}
    </section>
  );
}
