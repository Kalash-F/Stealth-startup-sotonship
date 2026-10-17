import { orchardGatePattern } from "@/data/selectors";
import { formatMoney } from "@/lib/format";

/** What the network shows that no single transaction does. */
export function PatternCallout() {
  const { flow, manufacturer, related, owner } = orchardGatePattern();
  const share = related ? Math.round((related.amount / flow.received) * 100) : 0;
  return (
    <section aria-labelledby="pattern-heading" className="rounded-md border border-border border-l-2 border-l-accent bg-surface px-4 py-3">
      <h2 id="pattern-heading" className="text-[13px] font-semibold text-fg">
        What the network shows
      </h2>
      <p className="mt-1 max-w-4xl text-[13px] leading-relaxed text-fg-muted">
        {flow.buyer.name} paid <span className="font-mono tabular text-fg">{formatMoney(flow.received)}</span> to {flow.seller.name}.
        The manufacturer that shipped the goods received{" "}
        <span className="font-mono tabular text-fg">{formatMoney(manufacturer?.amount ?? 0)}</span>. Within days,{" "}
        <span className="font-mono tabular text-risk-high">{formatMoney(related?.amount ?? 0)}</span> ({share}%) moved on to {related?.entity.name}, which shares a beneficial
        owner ({owner?.name}) with the intermediary. Each payment looks ordinary on its own; together they look like value moved through an
        over-priced invoice.
      </p>
    </section>
  );
}
