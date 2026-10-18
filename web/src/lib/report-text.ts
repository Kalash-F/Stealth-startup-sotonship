// Presentation helpers for checker reports: codes as officers write them, and the backend's
// working notes and warnings in plain words. Nothing here changes what the report says.
import { unitLabel } from "@/components/domain/price-band-bar";
import type { ReportLine } from "./api";

/** "847130" -> "8471.30" (HS subheading as printed in the tariff). */
export function formatHs(code: string) {
  return code.length > 4 ? `${code.slice(0, 4)}.${code.slice(4, 6)}` : code;
}

/** "84713000" -> "8471 30 00" (CN / UK commodity code as printed). */
export function formatCn(code: string) {
  return `${code.slice(0, 4)} ${code.slice(4, 6)} ${code.slice(6, 8)}`;
}

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "202307-202608" -> "July 2023 to August 2026"; "" when unknown. */
export function formatPricePeriod(period: string | undefined) {
  const m = /^(\d{4})(\d{2})-(\d{4})(\d{2})$/.exec(period ?? "");
  if (!m) return "";
  return `${months[+m[2] - 1]} ${m[1]} to ${months[+m[4] - 1]} ${m[3]}`;
}

const number = (n: number) => n.toLocaleString("en-GB", { maximumFractionDigits: 2 });
const plural = (n: number, word: string) => (n === 1 || word === "kg" ? word : `${word}s`);

/** How the line's quantity and price were turned into the comparison unit, or null when nothing was converted. */
export function conversionText(line: ReportLine, currency: string) {
  const unit = line.benchmark_unit;
  if (!unit || line.unit_price_usd == null) return null;
  const parts: string[] = [];
  const nq = line.normalised_quantity;
  if (nq != null && Math.abs(nq - line.quantity) > 1e-9) {
    parts.push(`${number(line.quantity)} ${line.unit} = ${number(nq)} ${plural(nq, unitLabel(unit))}`);
  }
  if (currency !== "USD") parts.push(`converted from ${currency} to USD`);
  if (!parts.length) return null;
  const price = line.unit_price_usd;
  return `For the comparison: ${parts.join(", ")}, so $${price.toLocaleString("en-GB", { maximumFractionDigits: price < 0.1 ? 4 : 2 })} per ${unitLabel(unit)}.`;
}

const fieldName: Record<string, string> = { quantity: "quantity", unit_price: "unit price", line_total: "line total" };

/**
 * Report warnings in the reader's words. Internal plumbing (which reader or model ran, a summary
 * that could not be written) is dropped: it does not change what the report can be relied on for.
 * A line that could not be classified also explains its skipped price check, so that is said once.
 */
export function readableWarnings(warnings: string[]) {
  const unclassified = new Set(warnings.map((w) => /^line (L\d+) could not be classified$/.exec(w)?.[1]).filter(Boolean));
  const out: string[] = [];
  for (const w of warnings) {
    let m: RegExpExecArray | null;
    if (/^(LLM |cached LLM|summary unavailable)/.test(w)) continue;
    if ((m = /^line (L\d+) could not be classified$/.exec(w))) {
      out.push(`Line ${m[1]}: no goods code could be assigned, so its price was not checked.`);
    } else if ((m = /^line (L\d+): no price benchmark or usable price/.exec(w))) {
      if (!unclassified.has(m[1])) out.push(`Line ${m[1]}: there are no comparison prices for its code, so its price was not checked.`);
    } else if ((m = /^line (L\d+) could not be enriched$/.exec(w))) {
      out.push(`Line ${m[1]} could not be processed.`);
    } else if ((m = /^(L\d+): (\w+) (\S+) not found in document text$/.exec(w))) {
      out.push(`Line ${m[1]}: the ${fieldName[m[2]] ?? m[2]} read (${m[3]}) is not in the PDF's text. Check it against the invoice.`);
    } else if ((m = /^stated total (\S+) not found in document text$/.exec(w))) {
      out.push(`The total read (${m[1]}) is not in the PDF's text. Check it against the invoice.`);
    } else if (/^stated total (not found|unreadable)/.test(w)) {
      out.push("The invoice total could not be read.");
    } else if ((m = /^(L\d+): could not read (\w+)/.exec(w))) {
      out.push(`Line ${m[1]}: the ${fieldName[m[2]] ?? m[2]} could not be read.`);
    } else if ((m = /^(seller|buyer|consignee): could not read country/.exec(w))) {
      out.push(`The ${m[1]}'s country could not be read from the address.`);
    } else if (/^no text layer/.test(w)) {
      out.push("This PDF has no text layer (it may be a scan), so it could not be read.");
    } else if (/^layout parser could not read/.test(w)) {
      out.push("The invoice layout could not be read, so some fields may be missing.");
    } else if (/^no line items found/.test(w)) {
      out.push("No goods lines were found on the invoice.");
    } else {
      out.push(w.charAt(0).toUpperCase() + w.slice(1).replace(/\.?$/, "."));
    }
  }
  return [...new Set(out)];
}
