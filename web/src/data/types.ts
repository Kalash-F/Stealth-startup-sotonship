/**
 * Front-end data model for the demo workspace.
 *
 * The invoice-level types mirror the frozen data contracts in plan.md §4
 * (Party, LineItem, Invoice, Benchmark, Flag, Report) so the officer checker
 * app (/checker) and a future API client can share them. The investigation
 * layer (cases, entities, transactions, timeline) is demo-only and sits on top.
 *
 * Every record in src/data is fictional. See src/data/README.md.
 */

export type CountryCode = "CN" | "AE" | "GB" | "CZ" | "DE";
export type Currency = "USD" | "GBP" | "EUR";

// ── plan.md §4 contracts ──────────────────────────────────────────────

export type AddressType = "commercial" | "residential" | "unknown";

export interface Party {
  name: string;
  address: string;
  country: CountryCode;
  address_type: AddressType;
  /** Demo-only link into the entity graph. */
  entityId?: string;
}

export interface LineItem {
  line_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
  extraction_confidence: number;
  /** Demo-only: HS6 assigned by classification, null when unclassifiable. */
  hs6: string | null;
  /**
   * Demo-only, mirrors EnrichedLine.unit_price_usd: stated price in USD per
   * benchmark unit. Filled from unit_price when the units already match.
   */
  unit_price_usd?: number | null;
  /** Demo-only: the band this line was checked against, when the check supplied one (invoices checked in the workspace). */
  benchmark?: Benchmark | null;
}

export interface Invoice {
  invoice_id: string;
  invoice_date: string; // ISO date
  seller: Party;
  buyer: Party;
  consignee: Party | null;
  country_of_origin: string | null;
  port_of_loading: string | null;
  port_of_discharge: string | null;
  incoterm: string | null;
  currency: Currency;
  line_items: LineItem[];
  stated_total: number;
  source_file: string;
  /** True for the generated test documents; false for an uploaded PDF. */
  is_synthetic: boolean;
}

export interface Benchmark {
  hs6: string;
  description: string;
  route: string | null;
  unit: string;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  n_observations: number;
  years: number[];
  sources: string[];
  /** True for illustrative bands (all the seeded cases); false for bands built from real trade data. */
  is_mock: boolean;
}

export type RuleId =
  | "PRICE_OUTLIER"
  | "QTY_VALUE_IMPLAUSIBLE"
  | "PLACEHOLDER_DESC"
  | "GEO_INCONSISTENT"
  | "ROUTE_NO_ECONOMIC_SENSE"
  | "ARITHMETIC_ERROR"
  | "RESIDENTIAL_CONSIGNEE"
  | "LOW_CONFIDENCE";

export type Severity = "low" | "medium" | "high";

export interface Flag {
  flag_id: string;
  rule: RuleId;
  line_id: string | null;
  severity: Severity;
  expected: string | null;
  stated: string | null;
  variance_pct: number | null;
  reason: string;
  evidence: Record<string, string | number>;
}

export type PriorityBand = "review_now" | "review" | "low";

// ── Investigation layer (demo only) ───────────────────────────────────

export type CaseStatus = "new" | "in_review" | "awaiting_info" | "escalated" | "closed_nfa";

/** How firmly an observation is established. See website.md §13. */
export type EvidenceClass = "anomaly" | "indicator" | "finding";

export interface Analyst {
  id: string;
  name: string;
  initials: string;
  role: string;
}

export interface TimelineEvent {
  id: string;
  at: string; // ISO datetime
  kind: "document" | "screening" | "case" | "payment" | "shipment" | "registry" | "note" | "request";
  title: string;
  detail: string;
  ref?: string;
}

export interface AnalystNote {
  id: string;
  at: string;
  authorId: string;
  body: string;
}

export interface AssessmentItem {
  id: string;
  class: EvidenceClass;
  statement: string;
  basis: string;
  /** Alternative explanation an investigator should consider, if any. */
  alternative?: string;
}

export interface Shipment {
  id: string;
  bill_of_lading: string;
  vessel: string;
  legs: { from: string; fromCountry: CountryCode; to: string; toCountry: CountryCode; departed: string; arrived: string }[];
  goods_description: string;
  gross_weight_kg: number;
  containers: string;
}

export interface Transaction {
  id: string;
  ref: string;
  at: string; // ISO date
  fromEntityId: string;
  toEntityId: string;
  amount: number;
  currency: Currency;
  narrative: string;
  caseIds: string[];
}

export interface Investigation {
  id: string;
  title: string;
  status: CaseStatus;
  priority_score: number;
  priority_band: PriorityBand;
  opened: string;
  updated: string;
  assigneeId: string;
  route: string; // e.g. "CN → AE → GB"
  corridor: string; // plan.md §5.2 route code, e.g. "AE-GB"
  hs6: string;
  commodity: string;
  invoice: Invoice;
  flags: Flag[];
  shipmentId: string | null;
  entityIds: string[];
  relatedCaseIds: string[];
  summary: string;
  nextAction: { label: string; due: string | null };
  timeline: TimelineEvent[];
  notes: AnalystNote[];
  assessment: AssessmentItem[];
}

export type EntityKind = "exporter" | "importer" | "intermediary" | "manufacturer" | "owner" | "consignee";

export interface Entity {
  id: string;
  name: string;
  kind: EntityKind;
  country: CountryCode;
  city: string;
  registration: string;
  incorporated: string | null;
  riskNote: string;
  caseIds: string[];
}

export type GraphNodeType = "entity" | "invoice" | "shipment" | "payment";

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  /** For entity nodes, the Entity id; for others, an invoice/shipment/transaction id. */
  refId: string;
  label: string;
  sublabel: string;
  x: number;
  y: number;
  emphasis?: "focus" | "risk" | "muted";
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  kind: "trade" | "money" | "ownership" | "document";
  emphasis?: "risk";
}
