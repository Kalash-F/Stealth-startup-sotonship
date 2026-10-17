import type { Flag, PriorityBand } from "@/data/types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

export interface ReportLine {
  line_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
  extraction_confidence: number;
  hs6: string | null;
  classification_confidence: number;
  normalised_quantity: number | null;
  unit_price_usd: number | null;
  benchmark_unit: string | null;
  normalisation_note: string;
  benchmark: { p10: number; median: number; p90: number; unit: string; is_mock: boolean } | null;
}

export interface Report {
  invoice_id: string;
  schema_version: string;
  priority_score: number;
  priority_band: PriorityBand;
  flags: Flag[];
  lines: ReportLine[];
  processing_ms: number;
  warnings: string[];
}

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      /* body was not JSON */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export async function listSamples(): Promise<Sample[]> {
  return parse<Sample[]>(await fetch(`${API_URL}/samples`));
}

export async function checkSample(invoiceId: string): Promise<Report> {
  return parse<Report>(await fetch(`${API_URL}/samples/${encodeURIComponent(invoiceId)}/check`, { method: "POST" }));
}

export async function checkUpload(file: File): Promise<Report> {
  const form = new FormData();
  form.append("file", file);
  return parse<Report>(await fetch(`${API_URL}/check`, { method: "POST", body: form }));
}
