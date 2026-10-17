/**
 * Derived views over the sample dataset used by the application screens.
 * Everything here is computed from the records in this folder, so the
 * dashboard, case pages and entity pages cannot disagree with each other.
 */
import { benchmarks, entities, entityById } from "./reference";
import { investigationById, investigations } from "./investigations";
import { graphEdges, graphNodes, shipments, transactions, transactionsForCase, transactionsForEntity } from "./network";
import { DEMO_NOW } from "./workspace";
import type { GraphEdge, GraphNode, Investigation, LineItem, Transaction } from "./types";

// ── Investigations list ───────────────────────────────────────────────

export const corridorOptions = [...new Set(investigations.map((i) => i.corridor))].sort();

/** Text that the investigations search matches against. */
export function caseSearchText(i: Investigation) {
  const inv = i.invoice;
  return [
    i.id,
    i.title,
    inv.invoice_id,
    inv.seller.name,
    inv.buyer.name,
    inv.consignee?.name ?? "",
    i.commodity,
    i.hs6,
    i.route,
    i.corridor,
  ]
    .join(" ")
    .toLowerCase();
}

/** Whole days from the demo's "today" to an ISO date (negative when past). */
export function daysFromDemoNow(iso: string) {
  const ms = new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime() - new Date(`${DEMO_NOW.slice(0, 10)}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

export function dueLabel(iso: string) {
  const d = daysFromDemoNow(iso);
  if (d === 0) return "due today";
  if (d === 1) return "due tomorrow";
  if (d > 1) return `due in ${d} days`;
  return `${Math.abs(d)} days overdue`;
}

// ── Invoice arithmetic and price comparison ───────────────────────────

export function lineArithmetic(l: LineItem) {
  const computed = Math.round(l.quantity * l.unit_price * 100) / 100;
  return { computed, matches: Math.abs(computed - l.line_total) < 0.01 };
}

export function invoiceArithmetic(i: Investigation) {
  const sumOfLines = i.invoice.line_items.reduce((s, l) => s + l.line_total, 0);
  const difference = Math.round((i.invoice.stated_total - sumOfLines) * 100) / 100;
  return { sumOfLines, stated: i.invoice.stated_total, difference, matches: Math.abs(difference) < 0.01 };
}

/** Variance of the stated USD unit price against the illustrative median, in %. */
export function lineVariance(l: LineItem) {
  if (!l.hs6 || l.unit_price_usd == null) return null;
  const b = benchmarks[l.hs6];
  if (!b) return null;
  return {
    pct: (l.unit_price_usd / b.median - 1) * 100,
    outside: l.unit_price_usd < b.p10 || l.unit_price_usd > b.p90,
    benchmark: b,
  };
}

// ── Entities, graph and money flows ───────────────────────────────────

export const nodeById = (id: string) => graphNodes.find((n) => n.id === id);
export const nodeForEntity = (entityId: string) => graphNodes.find((n) => n.type === "entity" && n.refId === entityId);

/** Graph neighbours of a node, with the connecting edge and its direction. */
export function neighboursOf(nodeId: string) {
  const out: { node: GraphNode; edge: GraphEdge; direction: "out" | "in" }[] = [];
  for (const e of graphEdges) {
    if (e.source === nodeId) out.push({ node: nodeById(e.target)!, edge: e, direction: "out" });
    if (e.target === nodeId) out.push({ node: nodeById(e.source)!, edge: e, direction: "in" });
  }
  return out;
}

/** Transactions referenced by a payment node (refId is a comma-separated list). */
export const transactionsForNode = (n: GraphNode): Transaction[] =>
  n.type === "payment" ? n.refId.split(",").map((id) => transactions.find((t) => t.id === id)!).filter(Boolean) : [];

export const caseForInvoice = (invoiceId: string) => investigations.find((i) => i.invoice.invoice_id === invoiceId);
export const caseForShipment = (shipmentId: string) => investigations.find((i) => i.shipmentId === shipmentId);
export const shipmentById = (id: string) => shipments.find((s) => s.id === id);

/** Cases an entity appears in, from the case records themselves. */
export const casesForEntity = (entityId: string) => investigations.filter((i) => i.entityIds.includes(entityId) || i.invoice.seller.entityId === entityId || i.invoice.buyer.entityId === entityId);

export function entityFlows(entityId: string) {
  const txs = transactionsForEntity(entityId).sort((a, b) => a.at.localeCompare(b.at));
  const inflow = txs.filter((t) => t.toEntityId === entityId).reduce((s, t) => s + t.amount, 0);
  const outflow = txs.filter((t) => t.fromEntityId === entityId).reduce((s, t) => s + t.amount, 0);
  return { txs, inflow, outflow };
}

/**
 * The part of the Orchard Gate graph that belongs to one case: the case's
 * entities, its invoice and shipment, and payment nodes tied to the case.
 * Returns null when the excerpt would not show any connections.
 */
export function graphExcerptForCase(i: Investigation) {
  const keep = new Set<string>();
  for (const n of graphNodes) {
    if (n.type === "entity" && i.entityIds.includes(n.refId)) keep.add(n.id);
    if (n.type === "invoice" && n.refId === i.invoice.invoice_id) keep.add(n.id);
    if (n.type === "shipment" && n.refId === i.shipmentId) keep.add(n.id);
    if (n.type === "payment" && transactionsForNode(n).some((t) => t.caseIds.includes(i.id))) keep.add(n.id);
  }
  const edges = graphEdges.filter((e) => keep.has(e.source) && keep.has(e.target));
  const connected = new Set(edges.flatMap((e) => [e.source, e.target]));
  const nodes = graphNodes.filter((n) => connected.has(n.id));
  if (edges.length < 2) return null;
  return { nodes, edges };
}

/**
 * Where the money went after the buyer paid the seller. Only meaningful when
 * the seller's onward payments are recorded against the case.
 */
export function fundsFlowForCase(i: Investigation) {
  const sellerId = i.invoice.seller.entityId;
  const buyerId = i.invoice.buyer.entityId;
  if (!sellerId || !buyerId) return null;
  const txs = transactionsForCase(i.id);
  const received = txs.filter((t) => t.fromEntityId === buyerId && t.toEntityId === sellerId).reduce((s, t) => s + t.amount, 0);
  const onward = new Map<string, number>();
  for (const t of txs.filter((t) => t.fromEntityId === sellerId)) onward.set(t.toEntityId, (onward.get(t.toEntityId) ?? 0) + t.amount);
  if (!received || onward.size === 0) return null;
  const recipients = [...onward.entries()]
    .map(([entityId, amount]) => ({ entity: entityById(entityId)!, amount }))
    .sort((a, b) => b.amount - a.amount);
  const forwarded = recipients.reduce((s, r) => s + r.amount, 0);
  return {
    invoiced: i.invoice.stated_total,
    received,
    recipients,
    retained: received - forwarded,
    seller: entityById(sellerId)!,
    buyer: entityById(buyerId)!,
  };
}

/** Figures for the pattern the Orchard Gate network reveals (entities page callout). */
export function orchardGatePattern() {
  const featured = investigationById("CASE-0142")!;
  const flow = fundsFlowForCase(featured)!;
  const manufacturer = flow.recipients.find((r) => r.entity.kind === "manufacturer");
  const related = flow.recipients.find((r) => r.entity.id === "ent-vltava");
  const owner = entities.find((e) => e.kind === "owner");
  return { flow, manufacturer, related, owner };
}
