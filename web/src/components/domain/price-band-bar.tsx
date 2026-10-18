import type { Benchmark } from "@/data/types";
import { formatUnitPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Stated unit price against the illustrative comparison band, on a log scale
 * so a 92× outlier and a 15% deviation are both readable.
 *   thin bar   p10–p90
 *   thick bar  p25–p75
 *   tick       median
 *   diamond    stated price
 */
export function PriceBandBar({
  benchmark,
  stated,
  size = "md",
  showLabels = true,
  className,
}: {
  benchmark: Pick<Benchmark, "p10" | "p25" | "median" | "p75" | "p90" | "unit">;
  stated: number;
  size?: "sm" | "md";
  showLabels?: boolean;
  className?: string;
}) {
  const { p10, p25, median, p75, p90 } = benchmark;
  const lo = Math.min(p10, stated) / 1.6;
  const hi = Math.max(p90, stated) * 1.6;
  const pos = (v: number) => ((Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * 100;

  const outside = stated < p10 || stated > p90;
  const ratio = stated / median;
  const ratioLabel = ratio >= 2 ? `${ratio.toFixed(ratio >= 10 ? 0 : 1)}× median` : ratio <= 0.5 ? `${(1 / ratio).toFixed(1)}× below median` : null;
  const h = size === "sm" ? "h-6" : "h-10";
  const statedColor = outside ? "var(--risk-high)" : "var(--risk-low)";

  return (
    <figure className={cn("w-full", className)}>
      <div
        className={cn("relative", h)}
        role="img"
        aria-label={`Stated ${formatUnitPrice(stated)} per ${benchmark.unit}. Illustrative range ${formatUnitPrice(p10)} to ${formatUnitPrice(p90)}, median ${formatUnitPrice(median)}.${outside ? " Outside range." : " Within range."}`}
      >
        {/* baseline */}
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
        {/* p10–p90 */}
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-fg-subtle/40"
          style={{ left: `${pos(p10)}%`, width: `${pos(p90) - pos(p10)}%` }}
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
              left: `${Math.min(pos(stated), stated > p90 ? pos(p90) : pos(p10))}%`,
              width: `${Math.abs(pos(stated) - (stated > p90 ? pos(p90) : pos(p10)))}%`,
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
        <figcaption className="mt-1.5 flex items-start justify-between gap-3 font-mono text-meta text-fg-subtle tabular">
          <span>
            Range {formatUnitPrice(p10)}–{formatUnitPrice(p90)} · median {formatUnitPrice(median)}
          </span>
          <span className={cn("text-right", outside ? "text-risk-high" : "text-risk-low")}>
            Stated {formatUnitPrice(stated)}
            {ratioLabel && outside ? ` · ${ratioLabel}` : ""}
          </span>
        </figcaption>
      ) : null}
    </figure>
  );
}
