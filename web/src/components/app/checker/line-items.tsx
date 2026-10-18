"use client";

import { SeverityTag } from "@/components/domain/status";
import { PriceBandBar, PriceBandLegend } from "@/components/domain/price-band-bar";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { rules } from "@/data/reference";
import { bandPosition, notClassifiedReason, type BandPosition, type HsInfo, type LiveBenchmark, type PriceBand, type Report, type ReportLine } from "@/lib/api";
import { formatMoney, formatUnitPrice } from "@/lib/format";
import { conversionText, formatCn, formatHs } from "@/lib/report-text";
import { cn } from "@/lib/utils";
import type { Currency } from "@/data/types";

/** Every goods line: what the invoice says, the code it was given, and how its price compares. */
export function LineItems({
  report,
  hs,
  active,
  onActive,
}: {
  report: Report;
  hs: Record<string, HsInfo>;
  active: string | null;
  onActive: (id: string | null) => void;
}) {
  const tails = report.lines.some((l) => l.benchmark?.p1 != null);
  const priced = report.lines.some((l) => l.benchmark && l.unit_price_usd);
  return (
    <Panel>
      <PanelHeader
        title="Goods lines"
        description="Each line as read from the invoice, the customs code it was given, and its price against UK import prices for that code."
      />
      {priced ? <PriceBandLegend tails={tails} className="border-b border-border px-4 py-2.5" /> : null}
      <ol className="divide-y divide-border">
        {report.lines.map((line) => (
          <LineItem
            key={line.line_id}
            line={line}
            report={report}
            hs={line.hs6 ? hs[line.hs6] : undefined}
            active={active === line.line_id}
            onActive={onActive}
          />
        ))}
      </ol>
    </Panel>
  );
}

function LineItem({
  line,
  report,
  hs,
  active,
  onActive,
}: {
  line: ReportLine;
  report: Report;
  hs: HsInfo | undefined;
  active: boolean;
  onActive: (id: string | null) => void;
}) {
  const currency = report.invoice.currency as Currency;
  const flags = report.flags.filter((f) => f.line_id === line.line_id);
  const conversion = conversionText(line, report.invoice.currency);
  const money = (v: number) => formatMoney(v, currency, { decimals: v < 1 ? 3 : 2 });
  return (
    <li
      id={`line-${line.line_id}`}
      className={cn("grid min-w-0 scroll-mt-4 gap-4 p-4 transition-colors duration-150", active && "bg-surface-2/70")}
      onMouseEnter={() => onActive(line.line_id)}
      onMouseLeave={() => onActive(null)}
      onFocus={() => onActive(line.line_id)}
      onBlur={() => onActive(null)}
    >
      <header className="grid gap-1.5">
        <h3 className="text-body font-medium text-fg">
          <span className="mr-2 font-mono text-small text-fg-subtle">{line.line_id}</span>
          {line.description}
        </h3>
        <p className="font-mono text-small tabular text-fg-muted">
          {line.quantity.toLocaleString("en-GB")} {line.unit} × {money(line.unit_price)} = {money(line.line_total)}
        </p>
        {flags.length ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label={`Flags on line ${line.line_id}`}>
            {flags.map((f) => (
              <li key={f.flag_id} className="inline-flex items-center gap-1.5 text-small text-fg-muted">
                <SeverityTag severity={f.severity} />
                {rules[f.rule].name}
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <Codes line={line} hs={hs} />

      {line.benchmark && line.unit_price_usd ? (
        <div className="grid min-w-0 gap-2">
          <PriceBandBar benchmark={line.benchmark} stated={line.unit_price_usd} size="sm" />
          {conversion ? <p className="text-small text-fg-subtle">{conversion}</p> : null}
          <p className="text-small text-fg-subtle">{comparedWith(line.benchmark)}</p>
          {line.benchmark.history?.length ? <YearByYear benchmark={line.benchmark} stated={line.unit_price_usd} /> : null}
        </div>
      ) : line.hs6 ? (
        <p className="text-small text-fg-muted">There are no comparison prices for this code yet, so its price was not checked.</p>
      ) : null}
    </li>
  );
}

/** The HS code the line was given, where it sits, and the CN code when the HS code settles it. */
function Codes({ line, hs }: { line: ReportLine; hs: HsInfo | undefined }) {
  if (!line.hs6) {
    const reason = notClassifiedReason(line.normalisation_note);
    return (
      <p className="rounded-md border border-dashed border-border-strong px-3 py-2.5 text-small text-fg">
        <span className="font-medium">No customs code assigned</span>
        {reason ? `: ${reason}` : ""}. The price of this line was not checked.
      </p>
    );
  }
  const others = line.hs6_candidates.filter((c) => c.hs6 !== line.hs6);
  const cn8 = hs?.cn8 ?? [];
  return (
    <dl className="grid gap-x-5 gap-y-3 rounded-md border border-border bg-surface-2/40 p-3 text-small sm:grid-cols-[6.5rem_minmax(0,1fr)]">
      <dt className="text-fg-subtle">HS code</dt>
      <dd className="grid min-w-0 gap-1">
        <p className="text-body text-fg">
          <span className="mr-2 font-mono font-medium tabular">{formatHs(line.hs6)}</span>
          {hs?.subheading.description || line.hs6_description}
        </p>
        {hs ? (
          <ul className="grid gap-0.5 text-fg-muted" aria-label="Where this code sits">
            <li className="line-clamp-1" title={hs.chapter.description}>
              <span className="font-mono tabular">Chapter {hs.chapter.code}</span> · {hs.chapter.description}
            </li>
            <li className="line-clamp-1" title={hs.heading.description}>
              <span className="font-mono tabular">Heading {hs.heading.code}</span> · {hs.heading.description}
            </li>
          </ul>
        ) : null}
      </dd>

      <dt className="text-fg-subtle">CN code</dt>
      <dd className="min-w-0 text-fg-muted">
        {cn8.length === 1 ? (
          <p>
            <span className="mr-2 font-mono font-medium tabular text-fg">{formatCn(cn8[0].code)}</span>
            the only 8-digit code under HS {formatHs(line.hs6)}
          </p>
        ) : cn8.length > 1 ? (
          <details className="group">
            <summary className="cursor-pointer select-none text-fg-muted hover:text-fg">
              Not set: {cn8.length} codes sit under HS {formatHs(line.hs6)}, and the description does not choose between them
            </summary>
            <ul className="mt-2 grid gap-1.5">
              {cn8.map((c) => (
                <li key={c.code} className="grid gap-x-3 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
                  <span className="font-mono tabular text-fg">{formatCn(c.code)}</span>
                  <span>{c.description}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : (
          <p>{hs ? "No 8-digit codes listed for this HS code." : "Looking up…"}</p>
        )}
      </dd>

      <dt className="text-fg-subtle">Confidence</dt>
      <dd className="text-fg-muted">
        <span className="font-mono tabular text-fg">{Math.round(line.classification_confidence * 100)}%</span>
        {others.length ? (
          <>
            {" "}
            · also considered{" "}
            {others.map((c, i) => (
              <span key={c.hs6}>
                {i ? ", " : ""}
                <span className="font-mono tabular">{formatHs(c.hs6)}</span> ({Math.round(c.score * 100)}%)
              </span>
            ))}
          </>
        ) : null}
      </dd>
    </dl>
  );
}

/** "Compared with 10,023 UK import prices for HS 8471.30 in 2025 (HMRC trade statistics)." */
function comparedWith(b: LiveBenchmark) {
  if (b.is_mock) return "These comparison prices are placeholders, not real trade data.";
  const n = b.n_observations.toLocaleString("en-GB");
  if (b.level && b.code) {
    const where =
      b.level === "hs4"
        ? `heading ${b.code} (too few prices for HS ${formatHs(b.hs6)} alone)`
        : b.level === "cn8"
          ? `CN ${formatCn(b.code)}`
          : `HS ${formatHs(b.code)}`;
    const when = b.period === "all" ? "across all years" : `in ${b.period}`;
    return `Compared with ${n} UK import prices for ${where} ${when}. Source: HMRC trade statistics, converted from pounds.`;
  }
  return `Compared with ${n} prices${b.route ? ` on the ${b.route.replace("-", " to ")} route` : ""}. Source: ${b.sources.join(", ")}.`;
}

const positionLabel: Record<BandPosition, string> = {
  extreme_low: "Below 1st percentile",
  low: "1st to 5th percentile",
  normal: "Normal",
  high: "95th to 99th percentile",
  extreme_high: "Above 99th percentile",
};

const positionTone: Record<BandPosition, string> = {
  extreme_low: "font-medium text-risk-high",
  low: "text-risk-review",
  normal: "text-fg-muted",
  high: "text-risk-review",
  extreme_high: "font-medium text-risk-high",
};

/** The stated price placed in every year of the series (and the origin's own band), so the
 * officer sees whether the price is out of line every year or only in one. */
function YearByYear({ benchmark, stated }: { benchmark: LiveBenchmark; stated: number }) {
  const periods = benchmark.history ?? [];
  const rows: { label: string; band: PriceBand; current: boolean }[] = periods.map((b) => ({
    label: b.period === "all" ? "All years" : `${b.period}${b.months < 12 ? ` (${b.months} months)` : ""}`,
    band: b,
    current: b.period === benchmark.period,
  }));
  if (benchmark.origin_band) {
    const o = benchmark.origin_band;
    rows.push({ label: `From ${o.origin}, ${o.period === "all" ? "all years" : o.period}`, band: o, current: false });
  }
  const counted = periods.filter((b) => b.n_observations >= 30);
  const out = counted.filter((b) => bandPosition(stated, b) !== "normal").length;
  return (
    <details className="min-w-0 text-small">
      <summary className="cursor-pointer select-none text-fg-muted hover:text-fg">
        Year by year: outside the normal range in {out} of {counted.length} periods
      </summary>
      <div className="mt-2 overflow-x-auto" tabIndex={0} role="region" aria-label="Year by year prices">
        <table className="w-full min-w-[540px] border-collapse whitespace-nowrap tabular">
          <caption className="sr-only">This invoice&apos;s price against each period of UK import prices, in USD</caption>
          <thead>
            <tr className="text-left text-fg-subtle">
              <th scope="col" className="py-1.5 pr-3 font-normal">Period</th>
              <th scope="col" className="py-1.5 pr-3 text-right font-normal">Prices</th>
              <th scope="col" className="py-1.5 pr-3 text-right font-normal">Normal range</th>
              <th scope="col" className="py-1.5 pr-3 text-right font-normal">Median</th>
              <th scope="col" className="py-1.5 pr-3 text-right font-normal">vs year before</th>
              <th scope="col" className="py-1.5 text-right font-normal">This invoice</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {rows.map(({ label, band, current }) => {
              const position = bandPosition(stated, band);
              const drift = band.median_vs_prev_year == null ? null : Math.round((band.median_vs_prev_year - 1) * 100);
              return (
                <tr key={label} className={cn("border-t border-border", current ? "font-medium text-fg" : "text-fg-muted")}>
                  <th scope="row" className="py-1.5 pr-3 text-left font-[inherit]">
                    {label}
                    {current ? <span className="text-fg-subtle"> · used</span> : null}
                  </th>
                  <td className="py-1.5 pr-3 text-right">{band.n_observations.toLocaleString("en-GB")}</td>
                  <td className="py-1.5 pr-3 text-right">
                    {formatUnitPrice(band.p5)} to {formatUnitPrice(band.p95)}
                  </td>
                  <td className="py-1.5 pr-3 text-right">{formatUnitPrice(band.median)}</td>
                  <td className="py-1.5 pr-3 text-right">
                    {drift == null ? "–" : drift === 0 ? "0%" : `${drift > 0 ? "+" : "−"}${Math.abs(drift)}%`}
                  </td>
                  <td className={cn("py-1.5 text-right font-sans", positionTone[position])}>{positionLabel[position]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
