import type { Currency } from "@/data/types";

const money = new Map<string, Intl.NumberFormat>();

/** Money with currency code, e.g. "USD 391,900". Decimals only when needed. */
export function formatMoney(value: number, currency: Currency = "USD", opts: { decimals?: number } = {}) {
  const decimals = opts.decimals ?? (Number.isInteger(value) ? 0 : 2);
  const key = `${currency}-${decimals}`;
  if (!money.has(key)) {
    money.set(key, new Intl.NumberFormat("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
  }
  return `${currency} ${money.get(key)!.format(value)}`;
}

/** Unit prices: keep enough precision for sub-cent values like $0.031. */
export function formatUnitPrice(value: number) {
  const decimals = value < 0.1 ? 3 : 2;
  return `$${value.toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

/** Compact money for chart axes and tiles, e.g. "USD 2.17m". */
export function formatMoneyCompact(value: number, currency: Currency = "USD") {
  if (Math.abs(value) >= 1_000_000) return `${currency} ${(value / 1_000_000).toFixed(2)}m`;
  if (Math.abs(value) >= 1_000) return `${currency} ${(value / 1_000).toFixed(0)}k`;
  return `${currency} ${value}`;
}

export function formatNumber(value: number) {
  return value.toLocaleString("en-GB");
}

/** Signed percentage, e.g. "+9,094%" or "−75.6%". Uses a true minus sign. */
export function formatVariance(pct: number) {
  const abs = Math.abs(pct);
  const body = abs >= 100 ? Math.round(abs).toLocaleString("en-GB") : abs.toFixed(1);
  return `${pct >= 0 ? "+" : "−"}${body}%`;
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dateShortFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false });

/** "4 Aug 2026" */
export function formatDate(iso: string) {
  return dateFmt.format(new Date(iso));
}
/** "4 Aug" */
export function formatDateShort(iso: string) {
  return dateShortFmt.format(new Date(iso));
}
/** "4 Aug 2026, 14:22 UTC" */
export function formatDateTime(iso: string) {
  return `${dateFmt.format(new Date(iso))}, ${timeFmt.format(new Date(iso))} UTC`;
}
