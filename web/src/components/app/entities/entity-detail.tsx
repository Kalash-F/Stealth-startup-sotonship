"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Banknote, FileText, MousePointerClick, Ship, X } from "lucide-react";
import { CaseStatusLabel, PriorityBadge } from "@/components/domain/status";
import { Badge } from "@/components/ui/badge";
import { countries, entityById } from "@/data/reference";
import { investigationById } from "@/data/investigations";
import {
  caseForInvoice,
  caseForShipment,
  casesForEntity,
  entityFlows,
  neighboursOf,
  shipmentById,
  transactionsForNode,
} from "@/data/selectors";
import type { Entity, GraphNode, Investigation, Transaction } from "@/data/types";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { entityKindLabel } from "../shared/entity-kind";
import type { Selection } from "./use-selection";

type SelectFn = (next: { entityId?: string; nodeId?: string } | null) => void;

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("border-t border-border px-4 py-3", className)}>
      <h3 className="eyebrow mb-2">{title}</h3>
      {children}
    </section>
  );
}

function CaseLinks({ cases }: { cases: Investigation[] }) {
  if (!cases.length) return <p className="text-[12.5px] text-fg-subtle">No cases.</p>;
  return (
    <ul className="grid gap-1.5">
      {cases.map((c) => (
        <li key={c.id} className="relative rounded-sm border border-border px-2.5 py-2 hover:bg-surface-2">
          <div className="flex items-center justify-between gap-2">
            <Link href={`/app/investigations/${c.id}`} className="font-mono text-[12px] text-fg after:absolute after:inset-0 hover:underline">
              {c.id}
            </Link>
            <PriorityBadge band={c.priority_band} score={c.priority_score} />
          </div>
          <p className="mt-0.5 text-[12.5px] leading-snug text-fg-muted">{c.title}</p>
          <CaseStatusLabel status={c.status} className="mt-0.5 text-[12px]" />
        </li>
      ))}
    </ul>
  );
}

function TxList({ txs, perspective }: { txs: Transaction[]; perspective?: string }) {
  return (
    <ul className="grid gap-1">
      {txs.map((t) => {
        const incoming = perspective ? t.toEntityId === perspective : false;
        const counterparty = entityById(perspective ? (incoming ? t.fromEntityId : t.toEntityId) : t.toEntityId)!;
        const from = entityById(t.fromEntityId)!;
        return (
          <li key={t.id} className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-start gap-2 text-[12.5px]">
            {perspective ? (
              incoming ? (
                <ArrowDownLeft className="mt-0.5 size-3.5 text-accent" aria-label="In" />
              ) : (
                <ArrowUpRight className="mt-0.5 size-3.5 text-risk-high" aria-label="Out" />
              )
            ) : (
              <Banknote className="mt-0.5 size-3.5 text-accent" aria-hidden />
            )}
            <span className="min-w-0">
              <span className="block truncate text-fg">
                {perspective ? `${incoming ? "from" : "to"} ${counterparty.name}` : `${from.name} → ${counterparty.name}`}
              </span>
              <span className="block truncate font-mono text-[11px] text-fg-subtle">
                {formatDate(t.at)} · {t.ref}
              </span>
              <span className="block truncate font-mono text-[11px] text-fg-subtle">{t.narrative}</span>
            </span>
            <span className={cn("font-mono tabular", perspective && !incoming ? "text-fg" : "text-fg")}>{formatMoney(t.amount, t.currency)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Connections({ node, select }: { node: GraphNode; select: SelectFn }) {
  const ns = neighboursOf(node.id);
  if (!ns.length) return null;
  return (
    <Section title={`Connected in the graph (${ns.length})`}>
      <ul className="grid gap-1">
        {ns.map(({ node: n, edge, direction }) => (
          <li key={edge.id}>
            <button
              type="button"
              onClick={() => select({ nodeId: n.id })}
              className="flex w-full items-center gap-2 rounded-sm border border-border px-2.5 py-1.5 text-left hover:border-border-strong hover:bg-surface-2"
            >
              <span className={cn("w-24 shrink-0 font-mono text-[10.5px]", edge.emphasis === "risk" ? "text-risk-high" : edge.kind === "money" ? "text-accent" : "text-fg-subtle")}>
                {direction === "out" ? edge.label : `← ${edge.label}`}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg">{n.label}</span>
              <ArrowRight className="size-3.5 shrink-0 text-fg-subtle" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Header({ eyebrow, title, sub, icon: Icon, onClear }: { eyebrow: string; title: string; sub?: React.ReactNode; icon?: typeof FileText; onClear: () => void }) {
  return (
    <header className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-0.5 flex items-center gap-2 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-fg">
          {Icon ? <Icon className="size-4 shrink-0 text-fg-muted" aria-hidden /> : null}
          <span className="min-w-0 break-words">{title}</span>
        </h2>
        {sub ? <div className="mt-1 text-[12.5px] text-fg-muted">{sub}</div> : null}
      </div>
      <button type="button" onClick={onClear} className="rounded-xs p-1 text-fg-subtle hover:bg-surface-2 hover:text-fg" aria-label="Clear selection">
        <X className="size-4" />
      </button>
    </header>
  );
}

function EntityBody({ entity, node, select }: { entity: Entity; node: GraphNode | null; select: SelectFn }) {
  const flows = entityFlows(entity.id);
  const cases = casesForEntity(entity.id);
  return (
    <>
      <Header
        eyebrow={entityKindLabel[entity.kind]}
        title={entity.name}
        onClear={() => select(null)}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{entity.country}</Badge>
            {entity.city}, {countries[entity.country].name}
            {!node ? <Badge tone="outline">Not in mapped network</Badge> : null}
          </span>
        }
      />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border px-4 py-3">
        <div className="min-w-0">
          <dt className="eyebrow">Registration</dt>
          <dd className="mt-0.5 break-words font-mono text-[12px] text-fg">{entity.registration}</dd>
        </div>
        <div>
          <dt className="eyebrow">Incorporated</dt>
          <dd className="mt-0.5 font-mono text-[12px] tabular text-fg">{entity.incorporated ? formatDate(entity.incorporated) : "Not applicable"}</dd>
        </div>
      </dl>
      <Section title="Investigator note">
        <p className="text-[13px] leading-relaxed text-fg-muted">{entity.riskNote}</p>
      </Section>
      <Section title={`Linked cases (${cases.length})`}>
        <CaseLinks cases={cases} />
      </Section>
      <Section title={`Transactions (${flows.txs.length})`}>
        {flows.txs.length ? (
          <>
            <dl className="mb-2.5 grid grid-cols-2 gap-2">
              <div className="rounded-sm border border-border px-2.5 py-1.5">
                <dt className="flex items-center gap-1 text-[11px] text-fg-subtle">
                  <ArrowDownLeft className="size-3 text-accent" aria-hidden /> Received
                </dt>
                <dd className="font-mono text-[13px] tabular text-fg">{formatMoney(flows.inflow)}</dd>
              </div>
              <div className="rounded-sm border border-border px-2.5 py-1.5">
                <dt className="flex items-center gap-1 text-[11px] text-fg-subtle">
                  <ArrowUpRight className="size-3 text-risk-high" aria-hidden /> Paid out
                </dt>
                <dd className="font-mono text-[13px] tabular text-fg">{formatMoney(flows.outflow)}</dd>
              </div>
            </dl>
            <TxList txs={flows.txs} perspective={entity.id} />
          </>
        ) : (
          <p className="text-[12.5px] text-fg-subtle">No payments recorded in the sample data.</p>
        )}
      </Section>
      {node ? <Connections node={node} select={select} /> : null}
    </>
  );
}

function NodeBody({ node, select }: { node: GraphNode; select: SelectFn }) {
  if (node.type === "invoice") {
    const c = caseForInvoice(node.refId);
    return (
      <>
        <Header eyebrow="Invoice" title={node.refId} icon={FileText} sub={node.sublabel} onClear={() => select(null)} />
        {c ? (
          <>
            <dl className="grid gap-2 border-t border-border px-4 py-3 text-[12.5px]">
              {[
                ["Seller", c.invoice.seller.name, c.invoice.seller.entityId],
                ["Buyer", c.invoice.buyer.name, c.invoice.buyer.entityId],
              ].map(([label, name, id]) => (
                <div key={label} className="grid grid-cols-[64px_1fr] gap-2">
                  <dt className="text-fg-subtle">{label}</dt>
                  <dd>
                    <button type="button" onClick={() => select({ entityId: id })} className="text-left text-fg hover:underline">
                      {name}
                    </button>
                  </dd>
                </div>
              ))}
              <div className="grid grid-cols-[64px_1fr] gap-2">
                <dt className="text-fg-subtle">Date</dt>
                <dd className="font-mono tabular text-fg">{formatDate(c.invoice.invoice_date)}</dd>
              </div>
              <div className="grid grid-cols-[64px_1fr] gap-2">
                <dt className="text-fg-subtle">Total</dt>
                <dd className="font-mono tabular text-fg">{formatMoney(c.invoice.stated_total, c.invoice.currency)}</dd>
              </div>
              <div className="grid grid-cols-[64px_1fr] gap-2">
                <dt className="text-fg-subtle">Lines</dt>
                <dd className="text-fg-muted">
                  {c.invoice.line_items.map((l) => (
                    <span key={l.line_id} className="block">
                      <span className="font-mono text-fg-subtle">{l.line_id}</span> {l.description}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
            <Section title="Case">
              <CaseLinks cases={[c]} />
            </Section>
          </>
        ) : null}
        <Connections node={node} select={select} />
      </>
    );
  }
  if (node.type === "payment") {
    const txs = transactionsForNode(node);
    const total = txs.reduce((s, t) => s + t.amount, 0);
    const cases = [...new Set(txs.flatMap((t) => t.caseIds))].map((id) => investigationById(id)!).filter(Boolean);
    return (
      <>
        <Header eyebrow="Payments" title={`${txs.length} ${txs.length === 1 ? "payment" : "payments"} · ${formatMoney(total)}`} icon={Banknote} onClear={() => select(null)} />
        <Section title="Transactions">
          <TxList txs={txs} />
        </Section>
        <Section title="Case">
          <CaseLinks cases={cases} />
        </Section>
        <Connections node={node} select={select} />
      </>
    );
  }
  // shipment
  const s = shipmentById(node.refId);
  const c = caseForShipment(node.refId);
  return (
    <>
      <Header eyebrow="Shipment" title={node.refId} icon={Ship} sub={s?.goods_description} onClear={() => select(null)} />
      {s ? (
        <dl className="grid gap-2 border-t border-border px-4 py-3 text-[12.5px]">
          <div className="grid grid-cols-[96px_1fr] gap-2">
            <dt className="text-fg-subtle">Bill of lading</dt>
            <dd className="break-words font-mono text-fg">{s.bill_of_lading}</dd>
          </div>
          <div className="grid grid-cols-[96px_1fr] gap-2">
            <dt className="text-fg-subtle">Gross weight</dt>
            <dd className="font-mono tabular text-fg">{formatNumber(s.gross_weight_kg)} kg</dd>
          </div>
          <div className="grid grid-cols-[96px_1fr] gap-2">
            <dt className="text-fg-subtle">Legs</dt>
            <dd className="text-fg">
              {s.legs.map((l, i) => (
                <span key={i} className="block">
                  {l.from} → {l.to} <span className="font-mono text-[11px] text-fg-subtle">{formatDate(l.departed)}</span>
                </span>
              ))}
            </dd>
          </div>
        </dl>
      ) : null}
      {c ? (
        <Section title="Case">
          <CaseLinks cases={[c]} />
        </Section>
      ) : null}
      <Connections node={node} select={select} />
    </>
  );
}

export function EntityDetail({ selection, select, invalid, className }: { selection: Selection; select: SelectFn; invalid?: boolean; className?: string }) {
  return (
    <div className={cn("rounded-md border border-border bg-surface", className)} aria-live="polite">
      {selection === null ? (
        <div className="grid gap-3 px-4 py-5">
          <MousePointerClick className="size-5 text-fg-subtle" aria-hidden />
          <div>
            <h2 className="text-[14px] font-semibold text-fg">{invalid ? "That record is not in the sample workspace" : "Select a node"}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
              Choose an entity, invoice, payment or shipment in the graph, or a company in the directory below, to see its records, cases and connections.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["ent-orchard", "ent-vltava", "ent-ferrant"].map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => select({ entityId: id })}
                className="rounded-sm border border-border-strong px-2.5 py-1.5 text-[12.5px] text-fg hover:bg-surface-2"
              >
                {entityById(id)!.name.split(" ").slice(0, 2).join(" ")}
              </button>
            ))}
          </div>
        </div>
      ) : selection.kind === "entity" ? (
        <EntityBody key={selection.entity.id} entity={selection.entity} node={selection.node} select={select} />
      ) : (
        <NodeBody key={selection.node.id} node={selection.node} select={select} />
      )}
    </div>
  );
}
