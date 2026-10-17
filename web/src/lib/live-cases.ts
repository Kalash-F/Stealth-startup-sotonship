// "Live cases": invoices checked in the workspace become cases in the in-memory dataset,
// so every screen that reads `investigations` (counts, queue, charts, list) updates.
// Nothing is saved: a full page reload resets to the sample data (the demo banner says so).
import { useSyncExternalStore } from "react";
import { investigations } from "@/data/investigations";
import { demoUserId, rules } from "@/data/reference";
import { DEMO_NOW } from "@/data/workspace";
import type { CountryCode, Currency, Investigation } from "@/data/types";
import type { Report } from "./checker-api";

export const LIVE_PREFIX = "LIVE-";

let version = 0; // bumps on every change; components subscribe to it to re-render
let counter = 0; // makes each new check's timestamp later than the previous one
const listeners = new Set<() => void>();
const reports = new Map<string, Report>(); // caseId -> full report, for the case page

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Call at the top of any component that shows case data, so it redraws on new live cases. */
export function useLiveVersion() {
  return useSyncExternalStore(subscribe, () => version, () => 0);
}

export function getLiveReport(caseId: string): { report: Report; title: string } | null {
  const report = reports.get(caseId);
  const inv = investigations.find((i) => i.id === caseId);
  return report && inv ? { report, title: inv.title } : null;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function toInvestigation(report: Report, meta: { route?: string; currency?: string }): Investigation {
  const id = `${LIVE_PREFIX}${report.invoice_id}`;
  const top = [...report.flags].sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.severity] - ({ high: 0, medium: 1, low: 2 })[b.severity])[0];
  const at = new Date(Date.parse(DEMO_NOW) + ++counter * 1000).toISOString();

  // Value: USD from the normalised lines when every line has it, else the printed line totals.
  const allUsd = report.lines.length > 0 && report.lines.every((l) => l.unit_price_usd !== null && l.normalised_quantity !== null);
  const value = allUsd
    ? sum(report.lines.map((l) => (l.unit_price_usd as number) * (l.normalised_quantity as number)))
    : sum(report.lines.map((l) => l.line_total));
  const currency = (allUsd ? "USD" : (meta.currency ?? "USD")) as Currency;
  const unknownParty = { name: "See invoice PDF", address: "", country: "" as unknown as CountryCode, address_type: "unknown" as const };

  return {
    id,
    title: `${report.invoice_id}: ${top ? rules[top.rule].name : "no rule fired"}`,
    status: "new",
    priority_score: Math.round(report.priority_score),
    priority_band: report.priority_band,
    opened: at,
    updated: at,
    assigneeId: demoUserId,
    route: meta.route ? meta.route.replace("-", " → ") : "Unknown",
    corridor: meta.route ?? "n/a",
    hs6: report.lines[0]?.hs6 ?? "unclassified",
    commodity: report.lines[0]?.description ?? "Unknown",
    invoice: {
      invoice_id: report.invoice_id,
      invoice_date: DEMO_NOW.slice(0, 10),
      seller: unknownParty,
      buyer: unknownParty,
      consignee: null,
      country_of_origin: null,
      port_of_loading: null,
      port_of_discharge: null,
      incoterm: null,
      currency,
      line_items: report.lines.map((l) => ({
        line_id: l.line_id,
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unit_price: l.unit_price,
        line_total: l.line_total,
        extraction_confidence: l.extraction_confidence,
        hs6: l.hs6,
        unit_price_usd: l.unit_price_usd,
      })),
      stated_total: value,
      source_file: `${report.invoice_id}.pdf`,
      is_synthetic: true,
    },
    flags: report.flags,
    shipmentId: null,
    entityIds: [],
    relatedCaseIds: [],
    summary: `Checked live in the invoice checker: ${report.flags.length} flag${report.flags.length === 1 ? "" : "s"} raised, priority ${Math.round(report.priority_score)}.`,
    nextAction: { label: "Review the flagged lines", due: null },
    timeline: [
      {
        id: "live-1",
        at,
        kind: "screening",
        title: `Invoice ${report.invoice_id} screened`,
        detail: `${report.flags.length} flag${report.flags.length === 1 ? "" : "s"}, priority ${Math.round(report.priority_score)}`,
      },
    ],
    notes: [],
    assessment: [],
  };
}

/**
 * Turn a checked invoice into a case, whatever its band (an invoice with no flags is a low case).
 * Re-checking the same invoice replaces its case.
 */
export function addLiveCase(report: Report, meta: { route?: string; currency?: string } = {}): Investigation | null {
  const id = `${LIVE_PREFIX}${report.invoice_id}`;
  const existing = investigations.findIndex((i) => i.id === id);
  if (existing >= 0) investigations.splice(existing, 1);
  reports.delete(id);
  const inv = toInvestigation(report, meta);
  investigations.push(inv);
  reports.set(id, report);
  version += 1;
  listeners.forEach((l) => l());
  return inv;
}
