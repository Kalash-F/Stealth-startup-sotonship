import type { Benchmark } from "@/data/types";
import { formatUnitPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

type Band = Pick<Benchmark, "p10" | "p25" | "median" | "p75" | "p90" | "unit"> & {
  p1?: number | null;
  p5?: number | null;
  p95?: number | null;
  p99?: number | null;
};

/**
 * Stated unit price against the comparison band, on a log scale
 * so a 92× outlier and a 15% deviation are both readable.
 *   thin bar   normal range: p5–p95 when the band has tails (benchmark databases), else p10–p90
 *   thick bar  p25–p75
 *   tick       median
 *   end marks  p1 and p99, when the band has them
 *   diamond    stated price: green normal, amber in a tail (p1–p5, p95–p99), red beyond p1 / p99
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

  const outside = stated < lo || stated > hi;
  const extreme = tails ? stated < outerLo || stated > outerHi : outside;
  const ratio = stated / median;
  const ratioLabel = ratio >= 2 ? `${ratio.toFixed(ratio >= 10 ? 0 : 1)}× median` : ratio <= 0.5 ? `${(1 / ratio).toFixed(1)}× below median` : null;
  const h = size === "sm" ? "h-6" : "h-10";
  const statedColor = extreme ? "var(--risk-high)" : outside ? "var(--risk-review)" : "var(--risk-low)";
  const rangeName = tails ? "Normal range (p5–p95)" : "Range";

  return (
    <figure className={cn("w-full", className)}>
      <div
        className={cn("relative", h)}
        role="img"
        aria-label={`Stated ${formatUnitPrice(stated)} per ${benchmark.unit}. ${rangeName} ${formatUnitPrice(lo)} to ${formatUnitPrice(hi)}, median ${formatUnitPrice(median)}.${
          tails ? ` 1st to 99th percentile ${formatUnitPrice(outerLo)} to ${formatUnitPrice(outerHi)}.` : ""
        }${extreme && tails ? " Beyond the 1st to 99th percentile." : outside ? " Outside range." : " Within range."}`}
      >
        {/* baseline */}
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
        {/* p1 and p99 */}
        {tails ? (
          <>
            <div className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-fg-subtle/60" style={{ left: `${pos(outerLo)}%` }} />
            <div className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-fg-subtle/60" style={{ left: `${pos(outerHi)}%` }} />
          </>
        ) : null}
        {/* normal range */}
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-fg-subtle/40"
          style={{ left: `${pos(lo)}%`, width: `${pos(hi) - pos(lo)}%` }}
        />
        {/* p25–p75 */}
        <div
          className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-xs bg-fg-subtle/70"
          style={{ left: `${pos(p25)}%`, width: `${pos(p75) - pos(p25)}%` }}
        />
        {/* median */}
        <div className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-fg" style={{ left: `${pos(median)}%` }} />
        {/* gap between band and an outlying stated price */}
        {outside ? (
          <div
            className="absolute top-1/2 h-px -translate-y-1/2 border-t border-dashed"
            style={{
              borderColor: statedColor,
              left: `${Math.min(pos(stated), stated > hi ? pos(hi) : pos(lo))}%`,
              width: `${Math.abs(pos(stated) - (stated > hi ? pos(hi) : pos(lo)))}%`,
            }}
          />
        ) : null}
        {/* stated */}
        <div
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2"
          style={{ left: `${pos(stated)}%`, borderColor: statedColor, background: "var(--surface)" }}
        />
      </div>
      {showLabels ? (
        <figcaption className="mt-1.5 flex flex-wrap items-start justify-between gap-x-3 gap-y-1 font-mono text-2xs text-fg-subtle tabular">
          <span>
            {tails ? "Normal" : "Range"} {formatUnitPrice(lo)}–{formatUnitPrice(hi)} · median {formatUnitPrice(median)}
            {tails ? ` · p1–p99 ${formatUnitPrice(outerLo)}–${formatUnitPrice(outerHi)}` : ""}
          </span>
          <span className={cn("text-right", extreme ? "text-risk-high" : outside ? "text-risk-review" : "text-risk-low")}>
            Stated {formatUnitPrice(stated)}
            {ratioLabel && outside ? ` · ${ratioLabel}` : ""}
          </span>
        </figcaption>
      ) : null}
    </figure>
  );
}
