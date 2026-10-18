import type { Benchmark } from "@/data/types";
import { formatUnitPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

type Band = Pick<Benchmark, "p10" | "p25" | "median" | "p75" | "p90" | "unit"> & {
  p1?: number | null;
  p5?: number | null;
  p95?: number | null;
  p99?: number | null;
};

const unitNames: Record<string, string> = { u: "item", unit: "item", l: "litre", litre: "litre", kg: "kg", pr: "pair" };

/** "u" -> "item", "kg" -> "kg": the benchmark unit as a reader says it. */
export function unitLabel(unit: string) {
  return unitNames[unit] ?? unit;
}

/** Clean ticks for a log axis between `min` and `max`: 1-2-5 steps when the range is narrow, decades when it is wide. */
function logTicks(min: number, max: number) {
  const lo = Math.floor(Math.log10(min));
  const hi = Math.ceil(Math.log10(max));
  const decades = hi - lo;
  const pick = (mult: number[], step = 1) => {
    const out: number[] = [];
    for (let e = lo; e <= hi; e += step) for (const m of mult) out.push(m * 10 ** e);
    return out.filter((v) => v >= min && v <= max);
  };
  if (decades > 6) return pick([1], 2);
  // the sparsest set that still gives three ticks
  const sets = [[1], [1, 3], [1, 2, 5], [1, 1.5, 2, 3, 5, 7]];
  for (const mult of sets) {
    const ticks = pick(mult);
    if (ticks.length >= 3) return ticks;
  }
  return pick(sets[sets.length - 1]);
}

/** Compact axis label: $0.5, $20, $3k, $1.5M. */
function axisLabel(v: number) {
  const short = (n: number) => String(Number(n.toPrecision(2)));
  if (v >= 1e6) return `$${short(v / 1e6)}M`;
  if (v >= 1e3) return `$${short(v / 1e3)}k`;
  return `$${short(v)}`;
}

/**
 * Stated unit price against the comparison band, on a log scale with a labelled price axis,
 * so a 92× outlier and a 15% deviation are both readable.
 *   thin bar   normal range: p5–p95 when the band has tails (benchmark databases), else p10–p90
 *   thick bar  middle half, p25–p75
 *   tick       median
 *   end marks  p1 and p99, when the band has them
 *   diamond    this invoice's price: green normal, amber in a tail (p1–p5, p95–p99), red beyond p1 / p99
 * The marks are explained once per section by <PriceBandLegend />.
 */
export function PriceBandBar({
  benchmark,
  stated,
  size = "md",
  showLabels = true,
  className,
}: {
  benchmark: Band;
  stated: number;
  size?: "sm" | "md";
  showLabels?: boolean;
  className?: string;
}) {
  const { p25, median, p75 } = benchmark;
  const tails = benchmark.p1 != null && benchmark.p5 != null && benchmark.p95 != null && benchmark.p99 != null;
  const lo = tails ? benchmark.p5! : benchmark.p10;
  const hi = tails ? benchmark.p95! : benchmark.p90;
  const outerLo = tails ? benchmark.p1! : lo;
  const outerHi = tails ? benchmark.p99! : hi;
  const min = Math.min(outerLo, stated) / 1.6;
  const max = Math.max(outerHi, stated) * 1.6;
  const pos = (v: number) => ((Math.log(v) - Math.log(min)) / (Math.log(max) - Math.log(min))) * 100;
  const ticks = logTicks(min, max);

  const outside = stated < lo || stated > hi;
  const extreme = tails ? stated < outerLo || stated > outerHi : outside;
  const ratio = stated / median;
  const ratioLabel =
    ratio >= 1.5 ? `${ratio.toFixed(ratio >= 10 ? 0 : 1)}× the median` : ratio <= 0.67 ? `${(1 / ratio).toFixed(1)}× below the median` : "close to the median";
  const statedColor = extreme ? "var(--risk-high)" : outside ? "var(--risk-review)" : "var(--risk-low)";
  const where = extreme
    ? stated > hi
      ? `above the ${tails ? "99th percentile" : "normal range"}`
      : `below the ${tails ? "1st percentile" : "normal range"}`
    : outside
      ? stated > hi
        ? "above the normal range"
        : "below the normal range"
      : "within the normal range";
  const unit = unitLabel(benchmark.unit);
  const at = pos(stated);
  // Keep the price label inside the chart: anchor it left or right of the marker near the edges.
  const labelAlign = at < 22 ? "left" : at > 78 ? "right" : "center";
  const plotH = size === "sm" ? "h-7" : "h-9";

  return (
    <figure className={cn("w-full min-w-0", className)}>
      <div aria-hidden className="relative">
        {/* the stated price, labelled where it sits */}
        <div className="relative h-5">
          <span
            className={cn(
              "absolute bottom-0 whitespace-nowrap font-mono text-meta font-medium text-fg tabular",
              labelAlign === "center" && "-translate-x-1/2",
              labelAlign === "right" && "-translate-x-full",
            )}
            style={{ left: `${at}%` }}
          >
            {formatUnitPrice(stated)}
          </span>
        </div>
        <div className={cn("relative", plotH)}>
          {/* p1 and p99 */}
          {tails ? (
            <>
              <div className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-fg-subtle" style={{ left: `${pos(outerLo)}%` }} />
              <div className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-fg-subtle" style={{ left: `${pos(outerHi)}%` }} />
            </>
          ) : null}
          {/* normal range */}
          <div
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-fg-subtle/45"
            style={{ left: `${pos(lo)}%`, width: `${pos(hi) - pos(lo)}%` }}
          />
          {/* middle half, p25–p75 */}
          <div
            className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-xs bg-fg-subtle/80"
            style={{ left: `${pos(p25)}%`, width: `${Math.max(pos(p75) - pos(p25), 0.5)}%` }}
          />
          {/* median */}
          <div className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-fg" style={{ left: `${pos(median)}%` }} />
          {/* gap between the band and an outlying price */}
          {outside ? (
            <div
              className="absolute top-1/2 h-px -translate-y-1/2 border-t border-dotted"
              style={{
                borderColor: statedColor,
                left: `${Math.min(at, stated > hi ? pos(hi) : pos(lo))}%`,
                width: `${Math.abs(at - (stated > hi ? pos(hi) : pos(lo)))}%`,
              }}
            />
          ) : null}
          {/* this invoice */}
          <div
            className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] border-2 shadow-[0_0_0_2px_var(--surface)]"
            style={{ left: `${at}%`, borderColor: statedColor, background: statedColor }}
          />
        </div>
        {/* price axis */}
        <div className="relative h-5 border-t border-border">
          {ticks.map((t) => {
            const p = pos(t);
            // ticks near an edge hang inwards so their labels never leave the chart
            const edge = p < 6 ? "items-start" : p > 94 ? "items-end -translate-x-full" : "items-center -translate-x-1/2";
            return (
              <span key={t} className={cn("absolute top-0 flex flex-col", edge)} style={{ left: `${p}%` }}>
                <span className="h-1 w-px bg-border-strong" />
                <span className="font-mono text-meta leading-4 text-fg-subtle tabular">{axisLabel(t)}</span>
              </span>
            );
          })}
        </div>
      </div>
      {showLabels ? (
        <figcaption className="mt-2 grid gap-0.5 text-small leading-snug text-fg-muted">
          <span>
            <span className="font-medium text-fg">This invoice {formatUnitPrice(stated)}</span> per {unit}: {where}, {ratioLabel}.
          </span>
          <span className="tabular">
            Normal range {formatUnitPrice(lo)} to {formatUnitPrice(hi)}, median {formatUnitPrice(median)}
            {tails ? `. 1st to 99th percentile ${formatUnitPrice(outerLo)} to ${formatUnitPrice(outerHi)}` : ""}. Log scale, USD.
          </span>
        </figcaption>
      ) : (
        <figcaption className="sr-only">
          This invoice {formatUnitPrice(stated)} per {unit}, {where}. Normal range {formatUnitPrice(lo)} to {formatUnitPrice(hi)}, median{" "}
          {formatUnitPrice(median)}.
        </figcaption>
      )}
    </figure>
  );
}

/** Explains the marks of every <PriceBandBar /> in a section, once. */
export function PriceBandLegend({ tails = true, className }: { tails?: boolean; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-5 gap-y-1.5 text-small text-fg-muted", className)} aria-label="How to read the price charts">
      <li className="flex items-center gap-2">
        <span aria-hidden className="h-2.5 w-5 rounded-xs bg-fg-subtle/80" />
        Middle half of prices
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden className="h-1 w-5 rounded-full bg-fg-subtle/45" />
        Normal range ({tails ? "5th–95th" : "10th–90th"} percentile)
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden className="h-3.5 w-0.5 bg-fg" />
        Median
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden className="flex gap-1">
          <span className="size-2.5 rotate-45 rounded-[2px] bg-risk-low" />
          <span className="size-2.5 rotate-45 rounded-[2px] bg-risk-review" />
          <span className="size-2.5 rotate-45 rounded-[2px] bg-risk-high" />
        </span>
        This invoice: normal, unusual, extreme
      </li>
    </ul>
  );
}
