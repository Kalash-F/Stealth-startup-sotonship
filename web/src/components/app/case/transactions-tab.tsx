import Link from "next/link";
import { ArrowRight, Ship } from "lucide-react";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { entityById, countries } from "@/data/reference";
import { transactionsForCase } from "@/data/network";
import { fundsFlowForCase, shipmentById } from "@/data/selectors";
import type { Investigation } from "@/data/types";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const entityLink = (id: string) => `/app/entities?entity=${id}`;
const pct = (part: number, whole: number) => `${((part / whole) * 100).toFixed(1)}%`;

function FundsFlow({ inv }: { inv: Investigation }) {
  const flow = fundsFlowForCase(inv);
  if (!flow) return null;
  const manufacturer = flow.recipients.find((r) => r.entity.kind === "manufacturer");
  const max = Math.max(flow.invoiced, flow.received);
  const rows = [
    { label: `Invoiced to ${flow.buyer.name}`, amount: flow.invoiced, color: "var(--fg-muted)", note: "Stated invoice total" },
    { label: `Received by ${flow.seller.name}`, amount: flow.received, color: "var(--accent)", note: `${pct(flow.received, flow.invoiced)} of invoice` },
    ...flow.recipients.map((r) => ({
      label: `Paid on to ${r.entity.name}`,
      amount: r.amount,
      color: r.entity.kind === "manufacturer" ? "var(--risk-low)" : "var(--risk-high)",
      note: `${pct(r.amount, flow.received)} of receipts · ${r.entity.kind === "manufacturer" ? "manufacturer" : "related party"}`,
      href: entityLink(r.entity.id),
    })),
    { label: `Retained by ${flow.seller.name}`, amount: flow.retained, color: "var(--fg-subtle)", note: `${pct(flow.retained, flow.received)} of receipts` },
  ];

  return (
    <Panel>
      <PanelHeader title="Where the money went" description="Payments recorded against this case, as a share of the invoice" />
      {manufacturer ? (
        <div className="grid border-b border-border sm:grid-cols-[1fr_auto_1fr]">
          <div className="p-4">
            <p className="text-small text-fg-muted">Manufacturer was paid</p>
            <p className="mt-1 font-mono text-display font-medium leading-none tabular text-fg">{formatMoney(manufacturer.amount)}</p>
            <p className="mt-1.5 text-small text-fg-subtle">{manufacturer.entity.name}</p>
          </div>
          <div className="flex items-center justify-center border-y border-border px-4 py-2 sm:border-x sm:border-y-0">
            <p className="text-center">
              <span className="block font-mono text-display tabular text-risk-high">{Math.round(flow.invoiced / manufacturer.amount)}×</span>
              <span className="text-meta text-fg-subtle">difference</span>
            </p>
          </div>
          <div className="p-4 sm:text-right">
            <p className="text-small text-fg-muted">Importer was invoiced</p>
            <p className="mt-1 font-mono text-display font-medium leading-none tabular text-fg">{formatMoney(flow.invoiced)}</p>
            <p className="mt-1.5 text-small text-fg-subtle">{flow.buyer.name}</p>
          </div>
        </div>
      ) : null}
      <ul className="grid gap-3 p-4">
        {rows.map((r) => (
          <li key={r.label} className="grid gap-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-small text-fg">
                {"href" in r && r.href ? (
                  <Link href={r.href} className="hover:underline">
                    {r.label}
                  </Link>
                ) : (
                  r.label
                )}
              </span>
              <span className="font-mono text-small tabular text-fg">
                {formatMoney(r.amount)} <span className="text-fg-subtle">· {r.note}</span>
              </span>
            </div>
            <div className="h-2 rounded-xs bg-surface-2" aria-hidden>
              <div className="h-full rounded-xs" style={{ width: `max(2px, ${(r.amount / max) * 100}%)`, background: r.color }} />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function TransactionsTab({ inv }: { inv: Investigation }) {
  const txs = transactionsForCase(inv.id).sort((a, b) => a.at.localeCompare(b.at));
  const shipment = inv.shipmentId ? shipmentById(inv.shipmentId) : null;
  const total = txs.reduce((s, t) => s + t.amount, 0);

  return (
    <div className="grid gap-4">
      <FundsFlow inv={inv} />

      <Panel>
        <PanelHeader title="Transactions" description={txs.length ? `${txs.length} payments linked to this case` : undefined} />
        {txs.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-body">
              <caption className="sr-only">Payments linked to {inv.id}</caption>
              <thead>
                <tr className="border-b border-border text-left text-meta uppercase tracking-[0.06em] text-fg-subtle">
                  <th scope="col" className="px-4 py-2 font-medium">Date</th>
                  <th scope="col" className="px-3 py-2 font-medium">Reference</th>
                  <th scope="col" className="px-3 py-2 font-medium">From → to</th>
                  <th scope="col" className="px-3 py-2 font-medium">Narrative</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {txs.map((t) => {
                  const from = entityById(t.fromEntityId)!;
                  const to = entityById(t.toEntityId)!;
                  return (
                    <tr key={t.id} className="hover:bg-surface-2">
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-small tabular text-fg-muted">{formatDate(t.at)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-small text-fg">{t.ref}</td>
                      <td className="px-3 py-2.5">
                        <Link href={entityLink(from.id)} className="text-fg hover:underline">{from.name}</Link>
                        <ArrowRight className="mx-1 inline size-3 text-fg-subtle" aria-label="to" />
                        <Link href={entityLink(to.id)} className="text-fg hover:underline">{to.name}</Link>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-meta text-fg-muted">{t.narrative}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono tabular text-fg">{formatMoney(t.amount, t.currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border-strong">
                  <th scope="row" colSpan={4} className="px-4 py-2 text-left text-small font-medium text-fg-muted">
                    Gross value moved (all directions)
                  </th>
                  <td className="px-4 py-2 text-right font-mono tabular text-fg">{formatMoney(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="px-4 py-6 text-body text-fg-muted">No payments are recorded against this case in the sample data. Payment data would normally come from the bank&rsquo;s own ledger.</p>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Shipment" description={shipment ? `Bill of lading ${shipment.bill_of_lading}` : undefined} />
        {shipment ? (
          <PanelBody className="grid gap-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              {[
                { label: "Goods", value: shipment.goods_description },
                { label: "Gross weight", value: `${formatNumber(shipment.gross_weight_kg)} kg`, mono: true },
                { label: "Containers", value: shipment.containers, mono: true },
                { label: "Vessel", value: shipment.vessel },
              ].map((f) => (
                <div key={f.label} className="min-w-0">
                  <dt className="eyebrow">{f.label}</dt>
                  <dd className={cn("mt-1 text-body text-fg", f.mono && "font-mono tabular")}>{f.value}</dd>
                </div>
              ))}
            </dl>
            <ol className="grid gap-2">
              {shipment.legs.map((l, idx) => (
                <li key={idx} className="grid gap-2 rounded-sm border border-border p-3 sm:grid-cols-[auto_1fr_auto_1fr] sm:items-center sm:gap-4">
                  <span className="flex items-center gap-2 text-meta text-fg-subtle">
                    <Ship className="size-3.5" aria-hidden /> Leg {idx + 1}
                  </span>
                  <span className="text-body text-fg">
                    {l.from} <span className="font-mono text-meta text-fg-subtle">{countries[l.fromCountry].short}</span>
                    <span className="block font-mono text-meta tabular text-fg-muted">departed {formatDate(l.departed)}</span>
                  </span>
                  <ArrowRight className="hidden size-4 text-fg-subtle sm:block" aria-hidden />
                  <span className="text-body text-fg">
                    {l.to} <span className="font-mono text-meta text-fg-subtle">{countries[l.toCountry].short}</span>
                    <span className="block font-mono text-meta tabular text-fg-muted">arrived {formatDate(l.arrived)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </PanelBody>
        ) : (
          <p className="px-4 py-6 text-body text-fg-muted">No transport documents are attached to this case yet.</p>
        )}
      </Panel>
    </div>
  );
}
