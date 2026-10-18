"use client";

import Link from "next/link";
import { CaseStatusLabel, PriorityBadge } from "@/components/domain/status";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { daysFromDemoNow } from "@/data/selectors";
import { attentionQueue } from "@/data/workspace";
import { formatDateShort, formatMoneyCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { analystById } from "@/data/reference";
import { useLiveVersion } from "@/lib/live-cases";

/**
 * Open cases in the order an investigator should look at them. Scrolls inside its own box when
 * the parent limits its height. `clearFloatingCard` adds room at the end so the last rows can
 * scroll out from under the pinned next-case card.
 */
export function AttentionQueue({ className, clearFloatingCard }: { className?: string; clearFloatingCard?: boolean }) {
  useLiveVersion();
  const rows = attentionQueue();
  return (
    <Panel className={cn("flex flex-col", className)}>
      <PanelHeader
        title="Attention queue"
        description="Open cases, review-now first, then by priority score"
        actions={
          <Link href="/app/investigations" className="text-small text-fg-muted hover:text-fg">
            All investigations
          </Link>
        }
      />
      <div className={cn("min-h-0 flex-1 overflow-auto", clearFloatingCard && "lg:pb-40")}>
        {/*
          A grid, not table layout: each column is as wide as its widest content and the spare width is
          shared equally between columns, so the gap from one column's content to the next is the same
          everywhere. Rows are subgrids so hover, borders and the row link still work per row.
        */}
        <table className="grid w-full min-w-[640px] grid-cols-[repeat(5,max-content)] justify-between text-body">
          <caption className="sr-only">Open cases needing attention</caption>
          <thead className="contents">
            <tr className="sticky top-0 z-[1] col-span-full grid grid-cols-subgrid border-b border-border bg-surface text-left text-meta font-medium text-fg-subtle">
              <th scope="col" className="py-2 pl-4 pr-3 font-medium">Case</th>
              <th scope="col" className="px-3 py-2 font-medium">Priority</th>
              <th scope="col" className="px-3 py-2 font-medium">Status</th>
              <th scope="col" className="px-3 py-2 font-medium">Value</th>
              <th scope="col" className="py-2 pl-3 pr-4 font-medium">Due</th>
            </tr>
          </thead>
          <tbody className="contents divide-y divide-border">
            {rows.map((c) => {
              const overdue = c.nextAction.due ? daysFromDemoNow(c.nextAction.due) < 0 : false;
              return (
                <tr
                  key={c.id}
                  className={cn(
                    "group relative col-span-full grid grid-cols-subgrid items-center hover:bg-surface-2",
                    c.priority_band === "review_now" && "shadow-[inset_2px_0_0_var(--risk-high)]",
                  )}
                >
                  <td className="py-2.5 pl-4 pr-3">
                    <Link href={`/app/investigations/${c.id}`} className="block after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus">
                      <span className="flex items-center gap-2 font-mono text-small text-fg-muted">
                        {c.id}
                        <abbr title={`Assigned to ${analystById(c.assigneeId)?.name}`} className="font-sans text-meta text-fg-subtle no-underline">
                          · {analystById(c.assigneeId)?.initials}
                        </abbr>
                      </span>
                      <span className="block truncate text-fg">{c.title}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <PriorityBadge band={c.priority_band} score={c.priority_score} />
                  </td>
                  <td className="px-3 py-2.5">
                    <CaseStatusLabel status={c.status} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono tabular text-fg">{formatMoneyCompact(c.invoice.stated_total, c.invoice.currency)}</td>
                  <td className="whitespace-nowrap py-2.5 pl-3 pr-4" title={c.nextAction.label}>
                    {c.nextAction.due ? (
                      <span className={cn("font-mono text-small tabular", overdue ? "text-risk-high" : "text-fg")}>
                        {formatDateShort(c.nextAction.due)}
                        {overdue ? <span className="ml-1.5 font-sans">overdue</span> : null}
                      </span>
                    ) : (
                      <span className="text-small text-fg-subtle">{c.status === "escalated" ? "With MLRO" : "Not set"}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
