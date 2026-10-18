/**
 * Client for the FastAPI backend (backend/tbml/api.py).
 *
 * Deployed on Vercel, the backend is served under /api on the same domain (vercel.json), so every
 * call is a same-origin fetch. In local dev, next.config.ts proxies /api to `make api` on :8000.
 * Types mirror backend/tbml/schemas.py (plan.md §4).
 */
import type { Benchmark, Flag, LineItem, PriorityBand } from "@/data/types";

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
  /** The backend band has no description; the line's hs6_description names the goods. */
  benchmark: Omit<Benchmark, "description"> | null;
}

/** A party as extracted: any ISO country code (ZZ when the extractor could not read one). */
export interface ReportParty {
  name: string;
  address: string;
  country: string;
  address_type: "commercial" | "residential" | "unknown";
}

/** Report.invoice (schema 1.2): the invoice as extracted, header and parties included. */
export interface ReportInvoice {
  invoice_id: string;
  invoice_date: string;
  seller: ReportParty;
  buyer: ReportParty;
  consignee: ReportParty | null;
  country_of_origin: string | null;
  port_of_loading: string | null;
  port_of_discharge: string | null;
  incoterm: string | null;
  currency: string;
  line_items: Omit<LineItem, "hs6" | "unit_price_usd" | "benchmark">[];
  stated_total: number;
  source_file: string;
  is_synthetic: boolean;
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
