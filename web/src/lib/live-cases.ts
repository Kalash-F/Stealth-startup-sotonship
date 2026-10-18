// "Live cases": invoices checked in the workspace become cases in the in-memory dataset, in the
// same shape as the seeded ones, so every screen that reads cases through useCases() (counts,
// queue, charts, list, search, the case page) shows them. They are numbered after the seeded cases and kept in
// this browser's localStorage, so they survive a reload; another browser never sees them.
import { useSyncExternalStore } from "react";
import { investigations, seededInvestigations } from "@/data/investigations";
import { demoUserId, rules } from "@/data/reference";
import { DEMO_NOW } from "@/data/workspace";
import type { AssessmentItem, Currency, Flag, Investigation, Party, RuleId, TimelineEvent } from "@/data/types";
import type { Report, ReportParty } from "./api";
import { formatMoney } from "./format";

const STORAGE_KEY = "ws-live-cases";

interface Stored {
  id: string;
  at: string;
  report: Report;
}

let restored = false; // true once this browser's saved cases are back in `investigations`
let snapshot: readonly Investigation[] = seededInvestigations; // a new array on every change
let stored: Stored[] = [];
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function changed() {
  snapshot = [...investigations];
  listeners.forEach((l) => l());
}

/**
 * Every case, for rendering. The server and the hydrating render get the sample cases only (what the
 * server knows), then React re-renders with this browser's checked cases. Read cases through this,
 * not the `investigations` array, in anything the server renders, or hydration will not match.
 */
export function useCases() {
  return useSyncExternalStore(subscribe, () => snapshot, () => seededInvestigations);
}

/** False until the saved cases have been restored (always false on the server). */
export function useLiveRestored() {
  return useSyncExternalStore(subscribe, () => restored, () => false);
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Private mode or full storage: the case still works until the page is reloaded.
  }
}

// ── Report → Investigation ───────────────────────────────────────────

const severityOrder = { high: 0, medium: 1, low: 2 } as const;

// Short words that stay capitalised in upper-case invoice text (PC, USB, M6), unless they are plain English.
const lowerWords = new Set(["OF", "AND", "FOR", "THE", "IN", "ON", "TO", "BY", "PER", "PCS", "KG", "X", "A", "AS", "OR", "WITH"]);

/** Sentence case for upper-case invoice text ("15.6-INCH NOTEBOOK PC" → "15.6-inch notebook PC"). */
function sentenceCase(s: string) {
  if (s !== s.toUpperCase()) return s;
  const words = s.split(" ").map((w) => (/^[A-Z0-9]{1,3}$/.test(w) && !lowerWords.has(w) ? w : w.toLowerCase()));
  const out = words.join(" ");
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** A short name for the goods: the description up to its first comma, at most about 40 characters. */
function goodsName(description: string | undefined) {
  if (!description) return "Goods";
  let s = sentenceCase(description.split(/[,;(]| - /)[0].trim());
  if (s.length > 42) s = `${s.slice(0, 40).replace(/\s+\S*$/, "")}…`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Case titles read like the seeded ones: what the goods are and what is wrong with the invoice. */
function caseTitle(goods: string, top: Report["flags"][number] | undefined) {
  if (!top) return `${goods} invoice with no flags raised`;
  const phrase: Record<RuleId, string> = {
    PRICE_OUTLIER: (top.variance_pct ?? 0) < 0 ? "priced far below comparison range" : "priced far above comparison range",
    QTY_VALUE_IMPLAUSIBLE: "line value implausible for the quantity",
    PLACEHOLDER_DESC: "invoice with a line that names no goods",
    GEO_INCONSISTENT: "invoice with an inconsistent country of origin",
    ROUTE_NO_ECONOMIC_SENSE: "routed with no clear economic reason",
    ARITHMETIC_ERROR: "invoice total does not reconcile",
    RESIDENTIAL_CONSIGNEE: "shipped to a residential address",
    LOW_CONFIDENCE: "invoice with figures that could not be read reliably",
  };
  return `${goods} ${phrase[top.rule]}`;
}

/** Countries the extractor could not read come back as ZZ. */
const known = (country: string) => (country && country !== "ZZ" ? country : null);

function toParty(p: ReportParty): Party {
  return { ...p, country: (known(p.country) ?? "ZZ") as Party["country"] };
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function addDays(iso: string, days: number) {
  return new Date(Date.parse(iso) + days * 86_400_000).toISOString().slice(0, 10);
}

function toInvestigation(id: string, at: string, report: Report): Investigation {
  const inv = report.invoice;
  const flags = [...report.flags].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]) as Flag[];
  const top = flags[0];
  const keyLine = report.lines.find((l) => l.line_id === top?.line_id) ?? report.lines[0];
  const goods = goodsName(keyLine?.description);
  const score = Math.round(report.priority_score);
  const currency = inv.currency as Currency;

  // Route as the backend compares prices: seller's country to the consignee's, else the buyer's.
  const from = known(inv.seller.country);
  const to = known((inv.consignee ?? inv.buyer).country);
  const corridor = from && to ? `${from}-${to}` : "n/a";

  const linesById = new Map(report.lines.map((l) => [l.line_id, l]));
  const line_items = inv.line_items.map((item) => {
    const l = linesById.get(item.line_id);
    return {
      ...item,
      hs6: l?.hs6 ?? null,
      unit_price_usd: l?.unit_price_usd ?? null,
      benchmark: l?.benchmark ? { ...l.benchmark, description: l.hs6_description ?? `HS ${l.hs6}` } : null,
    };
  });

  const nextAction =
    report.priority_band === "review_now"
      ? { label: "Review the flagged lines and request the supporting documents", due: addDays(at, 3) }
      : report.priority_band === "review"
        ? { label: "Review the flagged lines", due: addDays(at, 7) }
        : { label: "Confirm nothing else stands out, then close with no further action", due: null };

  // Screening finds anomalies; an analyst decides whether they become indicators or findings.
  const assessment: AssessmentItem[] = flags.map((f, n) => ({
    id: `a${n + 1}`,
    class: "anomaly",
    statement: f.reason,
    basis: [
      `Automated screening: ${rules[f.rule].name.toLowerCase()}`,
      f.line_id ? `line ${f.line_id}` : "whole invoice",
      f.expected && f.stated ? `expected ${f.expected}, stated ${f.stated}` : null,
    ]
      .filter(Boolean)
      .join(", ")
      .concat("."),
  }));

  const timeline: TimelineEvent[] = [
    {
      id: "t1",
      at: `${inv.invoice_date}T09:00:00Z`,
      kind: "document",
      title: "Invoice issued",
      detail: `${inv.seller.name} invoices ${inv.buyer.name} for ${formatMoney(inv.stated_total, currency)}${inv.incoterm ? `, ${inv.incoterm}` : ""}${inv.port_of_discharge ? ` ${inv.port_of_discharge}` : ""}.`,
      ref: inv.invoice_id,
    },
    {
      id: "t2",
      at,
      kind: "screening",
      title: "Invoice screened in the checker",
      detail: `${flags.length ? plural(flags.length, "flag") : "No flags"} raised across ${plural(report.lines.length, "line")}. Priority ${score}.`,
      ref: inv.source_file,
    },
    { id: "t3", at, kind: "case", title: "Case opened and assigned", detail: "Opened from the invoice check and assigned to you." },
  ];

  return {
    id,
    title: caseTitle(goods, top),
    status: "new",
    priority_score: score,
    priority_band: report.priority_band,
    opened: at,
    updated: at,
    assigneeId: demoUserId,
    route: from && to ? `${from} → ${to}` : "Not stated",
    corridor,
    hs6: keyLine?.hs6 ?? "unclassified",
    commodity: goods,
    invoice: {
      ...inv,
      seller: toParty(inv.seller),
      buyer: toParty(inv.buyer),
      consignee: inv.consignee ? toParty(inv.consignee) : null,
      currency,
      line_items,
    },
    flags,
    shipmentId: null,
    entityIds: [],
    relatedCaseIds: [],
    summary: report.summary ?? `Checked in the invoice checker: ${flags.length ? plural(flags.length, "flag") : "no flags"} raised.`,
    nextAction,
    timeline,
    notes: [],
    assessment,
  };
}

// ── Store ────────────────────────────────────────────────────────────

/** The next free CASE-#### number after the seeded and live cases. */
function nextCaseId() {
  const max = Math.max(0, ...investigations.map((i) => Number(/^CASE-(\d+)$/.exec(i.id)?.[1] ?? 0)));
  return `CASE-${String(max + 1).padStart(4, "0")}`;
}

function put(entry: Stored) {
  const existing = investigations.findIndex((i) => i.id === entry.id);
  if (existing >= 0) investigations.splice(existing, 1);
  investigations.push(toInvestigation(entry.id, entry.at, entry.report));
}

/**
 * Put this browser's saved cases back into the dataset. Called once from the workspace shell
 * after hydration, so the server render and the first client render agree.
 */
export function restoreLiveCases() {
  if (restored) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    // Reports saved before schema 1.2 have no invoice and cannot be shown as cases.
    stored = Array.isArray(parsed) ? (parsed as Stored[]).filter((e) => e?.id && e.report?.invoice) : [];
  } catch {
    stored = [];
  }
  stored.forEach(put);
  restored = true;
  changed();
}

/**
 * Turn a checked invoice into a case, whatever its band (an invoice with no flags is a low case).
 * Re-checking the same invoice replaces its case and keeps its number.
 */
export function addLiveCase(report: Report): Investigation | null {
  if (!report.invoice) return null; // a backend older than schema 1.2
  restoreLiveCases();
  const previous = stored.find((e) => e.report.invoice_id === report.invoice_id);
  const entry: Stored = {
    id: previous?.id ?? nextCaseId(),
    at: new Date(Date.parse(DEMO_NOW) + (stored.length + 1) * 60_000).toISOString(),
    report,
  };
  stored = [...stored.filter((e) => e !== previous), entry];
  put(entry);
  save();
  changed();
  return investigations.find((i) => i.id === entry.id) ?? null;
}
