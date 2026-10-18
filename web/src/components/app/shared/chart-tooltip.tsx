import { cn } from "@/lib/utils";

export interface TooltipRow {
  label: string;
  value: string;
  swatch?: string;
}

/** Tooltip body shared by every workspace chart. Text stays in ink tokens. */
export function ChartTooltipBox({ title, rows, className }: { title: string; rows: TooltipRow[]; className?: string }) {
  return (
    <div className={cn("min-w-40 rounded-sm border border-border-strong bg-surface-3 px-2.5 py-2 text-small text-fg shadow-frame", className)}>
      <p className="mb-1.5 font-medium">{title}</p>
      <dl className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1">
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <span className="size-2 rounded-[2px]" style={{ background: r.swatch ?? "transparent" }} aria-hidden />
            <dt className="text-fg-muted">{r.label}</dt>
            <dd className="text-right font-mono tabular">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export const axisTick = { fill: "var(--fg-subtle)", fontSize: 12, fontFamily: "var(--font-mono)" };
