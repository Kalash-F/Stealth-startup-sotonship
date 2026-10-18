import { investigations } from "./investigations";
import { analystById, rules } from "./reference";
import type { CaseStatus, Investigation, PriorityBand, RuleId } from "./types";

/** "Today" inside the demo workspace. Keeps relative dates stable. */
export const DEMO_NOW = "2026-10-17T09:00:00Z";

export const workspace = {
  name: "Trade Finance Investigations",
  org: "Sample workspace",
  dataNotice: "All companies, people, documents and payments in this workspace are fictional.",
};

/**
 * Synthetic screening volumes for the whole sample portfolio. Only flagged
 * invoices become cases, so these totals are larger than the case list.
 * October is month-to-date.
 */
export const screeningSeries = [
  { month: "May", screened: 1184, flagged: 61, reviewNow: 6 },
  { month: "Jun", screened: 1262, flagged: 58, reviewNow: 5 },
  { month: "Jul", screened: 1219, flagged: 73, reviewNow: 9 },
  { month: "Aug", screened: 1307, flagged: 88, reviewNow: 12 },
  { month: "Sep", screened: 1241, flagged: 79, reviewNow: 10 },
  { month: "Oct", screened: 672, flagged: 41, reviewNow: 6, partial: true },
] as const;

export const statusLabel: Record<CaseStatus, string> = {
  new: "New",
  in_review: "In review",
  awaiting_info: "Awaiting information",
  escalated: "Escalated",
  closed_nfa: "Closed · no further action",
};

export const bandLabel: Record<PriorityBand, string> = {
  review_now: "Review now",
  review: "Review",
  low: "Low",
};

export const isOpen = (i: Investigation) => i.status !== "closed_nfa";

// Every helper below takes the case list, so components pass the hydration-safe one from useCases().
export function caseCounts(list: readonly Investigation[] = investigations) {
  const open = list.filter(isOpen);
  return {
    open: open.length,
    reviewNow: open.filter((i) => i.priority_band === "review_now").length,
    review: open.filter((i) => i.priority_band === "review").length,
    low: open.filter((i) => i.priority_band === "low").length,
    escalated: list.filter((i) => i.status === "escalated").length,
    awaiting: list.filter((i) => i.status === "awaiting_info").length,
    closed: list.length - open.length,
    unassignedTriage: list.filter((i) => i.status === "new").length,
  };
}

/** Flag counts by rule across every case, highest first. */
export function flagsByRule(list: readonly Investigation[] = investigations) {
  const counts = new Map<RuleId, { high: number; medium: number; low: number }>();
  for (const inv of list) {
    for (const f of inv.flags) {
      const c = counts.get(f.rule) ?? { high: 0, medium: 0, low: 0 };
      c[f.severity] += 1;
      counts.set(f.rule, c);
    }
  }
  return [...counts.entries()]
    .map(([rule, c]) => ({ rule, label: rules[rule].short, ...c, total: c.high + c.medium + c.low }))
    .sort((a, b) => b.total - a.total);
}

/** Invoiced value under open cases, grouped by plan.md §5.2 corridor. */
export function valueByCorridor(list: readonly Investigation[] = investigations) {
  const m = new Map<string, { corridor: string; value: number; cases: number }>();
  for (const inv of list.filter(isOpen)) {
    const row = m.get(inv.corridor) ?? { corridor: inv.corridor, value: 0, cases: 0 };
    row.value += inv.invoice.stated_total;
    row.cases += 1;
    m.set(inv.corridor, row);
  }
  return [...m.values()].sort((a, b) => b.value - a.value);
}

/** Most recent timeline events across all cases. */
export function recentActivity(limit = 8, list: readonly Investigation[] = investigations) {
  return list
    .flatMap((inv) => inv.timeline.map((e) => ({ ...e, caseId: inv.id, caseTitle: inv.title })))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

/** Open cases that need attention, review-now first, then by score. */
export function attentionQueue(list: readonly Investigation[] = investigations) {
  const order: Record<PriorityBand, number> = { review_now: 0, review: 1, low: 2 };
  return list
    .filter(isOpen)
    .sort((a, b) => order[a.priority_band] - order[b.priority_band] || b.priority_score - a.priority_score);
}

export const assigneeName = (id: string) => analystById(id)?.name ?? "Unassigned";
