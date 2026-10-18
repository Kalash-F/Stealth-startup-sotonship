/**
 * Client for the FastAPI backend (backend/tbml/api.py).
 *
 * Deployed on Vercel, the backend is served under /api on the same domain (vercel.json), so every
 * call is a same-origin fetch. In local dev, next.config.ts proxies /api to `make api` on :8000.
 * Types mirror backend/tbml/schemas.py (plan.md §4).
 */
import type { Flag, LineItem, PriorityBand } from "@/data/types";

const BASE = "/api";

export interface Health {
  status: string;
  schema_version: string;
  stubs: boolean;
  benchmarks: "mock" | "real";
  /** Chat model: "openrouter:<model>", "anthropic:<model>" or "offline". */
  llm?: string;
  /** HS classifier: "jev:<model>", "hierarchical:<model>", "flat:<model>" or "keyword". */
  classifier?: string;
  /** Price data: "database:<n> shards" (HMRC benchmark databases) or the band file name. */
  price_data?: string;
}

export interface Sample {
  invoice_id: string;
  file: string;
  kind: "clean" | "anomalous" | "hard_negative";
  planted: string[];
  template: string;
  route: string;
  currency: string;
  n_lines: number;
}

export interface HS6Candidate {
  hs6: string;
  score: number;
}

/** Where a price sits in a band with tails (backend rules/price_outlier.position). */
export type BandPosition = "extreme_low" | "low" | "normal" | "high" | "extreme_high";

/** One period of the HMRC benchmark databases, USD per `unit` (backend PriceBand). */
export interface PriceBand {
  level: "cn8" | "hs6" | "hs4";
  code: string;
  basis: "per_unit" | "per_kg";
  unit: string;
  /** "2023" ... "2026", or "all" for every year pooled. */
  period: string;
  /** "ALL" (every origin pooled) or an ISO-2 country. */
  origin: string;
  recommended: boolean;
  n_observations: number;
  months: number;
  p1: number;
  p5: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  /** This period's median over the previous year's (1.15 = +15%). */
  median_vs_prev_year: number | null;
}

/** Backend Benchmark (schema 1.2). Database bands add the tails, the series and the context. */
export interface LiveBenchmark {
  hs6: string;
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
  is_mock: boolean;
  p1?: number | null;
  p5?: number | null;
  p95?: number | null;
  p99?: number | null;
  level?: "cn8" | "hs6" | "hs4" | null;
  code?: string | null;
  basis?: "per_unit" | "per_kg" | null;
  period?: string | null;
  history?: PriceBand[];
  origin_band?: PriceBand | null;
  other_basis?: PriceBand | null;
}

/** Same tiers as the backend: p5-p95 normal, p1-p5 / p95-p99 review, beyond p1 / p99 extreme. */
export function bandPosition(price: number, b: Pick<PriceBand, "p1" | "p5" | "p95" | "p99">): BandPosition {
  if (price < b.p1) return "extreme_low";
  if (price < b.p5) return "low";
  if (price > b.p99) return "extreme_high";
  if (price > b.p95) return "high";
  return "normal";
}

/** Report.lines: LineItem + EnrichedLine, plus the price band used (backend ReportLine). */
export interface ReportLine extends Omit<LineItem, "hs6" | "unit_price_usd" | "benchmark"> {
  hs6: string | null;
  hs6_description: string | null;
  hs6_candidates: HS6Candidate[];
  classification_confidence: number;
  normalised_quantity: number | null;
  benchmark_unit: string | null;
  unit_price_usd: number | null;
  normalisation_note: string;
  benchmark: LiveBenchmark | null;
}

export interface Report {
  invoice_id: string;
  schema_version: string;
  priority_score: number;
  priority_band: PriorityBand;
  /** 1-2 sentence overview of the report (LLM-written, a template offline, null if the LLM call failed). */
  summary: string | null;
  invoice: ReportInvoice;
  flags: (Omit<Flag, "evidence"> & { evidence: Record<string, unknown> })[];
  lines: ReportLine[];
  processing_ms: number;
  warnings: string[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { cache: "no-store", ...init });
  } catch {
    throw new ApiError("Could not reach the checker service. Is the backend running?", 0);
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status}).`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      /* not JSON */
    }
    throw new ApiError(detail, res.status);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => call<Health>("/health"),
  samples: () => call<Sample[]>("/samples"),
  checkSample: (invoiceId: string) =>
    call<Report>(`/samples/${encodeURIComponent(invoiceId)}/check`, { method: "POST" }),
  checkUpload: (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return call<Report>("/check", { method: "POST", body });
  },
};

/** The classifier's HS path ("84 … (0.97) > 8471 … > 847130 …") from a line's note, if any. */
export function hsPath(note: string): string | null {
  // HS names contain ";" too, so match up to the last "(0.92)" score, not the first ";"
  const m = /^HS path: (.*\(\d\.\d\d\))(?:;|$)/.exec(note);
  return m ? m[1] : null;
}

/** Why a line could not be classified, from its note ("not classified: <reason>;"). */
export function notClassifiedReason(note: string): string | null {
  const m = /^not classified: (.*?);/.exec(note);
  return m ? m[1] : null;
}
