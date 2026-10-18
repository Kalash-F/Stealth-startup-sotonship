import { CalendarClock, CircleCheck } from "lucide-react";
import type { CaseStatus, Investigation } from "@/data/types";
import { analystById } from "@/data/reference";
import { daysFromDemoNow, dueLabel } from "@/data/selectors";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AnalystAvatar } from "../shared/analyst-avatar";

/** Key facts and the next action, directly under the case title. */
export function CaseFacts({
  inv,
  status,
  assigneeId,
  actions,
}: {
  inv: Investigation;
  status: CaseStatus;
  assigneeId: string;
  actions: React.ReactNode;
}) {
  const facts = [
    { label: "Assignee", value: <AnalystAvatar id={assigneeId} withName />, sub: analystById(assigneeId)?.role },
    { label: "Opened", value: <span className="font-mono tabular">{formatDate(inv.opened)}</span> },
    { label: "Updated", value: <span className="font-mono tabular">{formatDate(inv.updated)}</span>, title: formatDateTime(inv.updated) },
    { label: "Route", value: <span className="font-mono">{inv.route}</span>, sub: `Corridor ${inv.corridor}` },
    { label: "Invoice", value: <span className="font-mono">{inv.invoice.invoice_id}</span>, sub: formatMoney(inv.invoice.stated_total, inv.invoice.currency) },
    { label: "Commodity", value: inv.commodity, sub: `HS ${inv.hs6}` },
  ];
  const closed = status === "closed_nfa";
  const escalatedLocally = status === "escalated" && inv.status !== "escalated";
  const due = inv.nextAction.due;
  const overdue = due ? daysFromDemoNow(due) < 0 : false;

  return (
    <div className="grid gap-4 border-b border-border px-4 py-4 lg:px-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6 2xl:grid-cols-3">
        {facts.map((f) => (
          <div key={f.label} className="min-w-0" title={f.title}>
            <dt className="eyebrow">{f.label}</dt>
            <dd className="mt-1 truncate text-body text-fg">{f.value}</dd>
            {f.sub ? <dd className="truncate font-mono text-meta text-fg-subtle">{f.sub}</dd> : null}
          </div>
        ))}
      </dl>
      <section
        aria-labelledby="next-action-heading"
        className={cn(
          "flex flex-col gap-3 rounded-md border bg-surface p-3 lg:flex-row lg:items-center lg:justify-between",
          closed ? "border-border" : "border-accent/45",
        )}
      >
        <div className="min-w-0">
          <h2 id="next-action-heading" className="eyebrow !text-accent">
            Next action
          </h2>
          <p className="mt-1 text-body font-medium leading-snug text-fg">
            {escalatedLocally ? "Awaiting MLRO decision (escalated in this session)" : inv.nextAction.label}
          </p>
          {due && !escalatedLocally ? (
            <p className={cn("mt-1 flex items-center gap-1.5 font-mono text-small tabular", overdue ? "text-risk-high" : "text-risk-review")}>
              <CalendarClock className="size-3.5" aria-hidden />
              Due {formatDate(due)} · {dueLabel(due)}
            </p>
          ) : (
            <p className="mt-1 flex items-center gap-1.5 text-small text-fg-subtle">
              <CircleCheck className="size-3.5" aria-hidden />
              {closed ? "Closed, no further action" : "No due date set"}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">{actions}</div>
      </section>
    </div>
  );
}
