import Link from "next/link";
import { CaseStatusLabel, PriorityBadge } from "@/components/domain/status";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { dueLabel, daysFromDemoNow } from "@/data/selectors";
import { attentionQueue } from "@/data/workspace";
import { formatDateShort, formatMoneyCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { analystById } from "@/data/reference";

/** Open cases in the order an investigator should look at them. */
export function AttentionQueue({ className }: { className?: string }) {
  const rows = attentionQueue();
  return (
    <Panel className={cn("flex flex-col", className)}>
      <PanelHeader
        title="Attention queue"
        description="Open cases, review-now first, then by priority score"
        actions={
          <Link href="/app/investigations" className="text-[12px] text-fg-muted hover:text-fg">
            All investigations
          </Link>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <caption className="sr-only">Open cases needing attention</caption>
          <thead>
            <tr className="border-b border-border text-left text-[11px] font-medium uppercase tracking-[0.06em] text-fg-subtle">
              <th scope="col" className="px-4 py-2 font-medium">Case</th>
              <th scope="col" className="px-3 py-2 font-medium">Priority</th>
              <th scope="col" className="px-3 py-2 font-medium">Status</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Value</th>
              <th scope="col" className="px-3 py-2 font-medium">Due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((c) => {
              const overdue = c.nextAction.due ? daysFromDemoNow(c.nextAction.due) < 0 : false;
              return (
                <tr key={c.id} className="group relative hover:bg-surface-2">
                  <td className="max-w-[230px] px-4 py-2.5">
                    <Link href={`/app/investigations/${c.id}`} className="block after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus">
                      <span className="flex items-center gap-2 font-mono text-[12px] text-fg-muted">
                        {c.id}
                        <abbr title={`Assigned to ${analystById(c.assigneeId)?.name}`} className="font-sans text-[11px] text-fg-subtle no-underline">
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
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular text-fg">{formatMoneyCompact(c.invoice.stated_total, c.invoice.currency)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5" title={c.nextAction.label}>
                    {c.nextAction.due ? (
                      <>
                        <span className="block font-mono text-[12px] tabular text-fg">{formatDateShort(c.nextAction.due)}</span>
                        <span className={cn("text-[11.5px]", overdue ? "text-risk-high" : "text-fg-subtle")}>{dueLabel(c.nextAction.due)}</span>
                      </>
                    ) : (
                      <span className="text-[12px] text-fg-subtle">{c.status === "escalated" ? "With MLRO" : "Not set"}</span>
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
