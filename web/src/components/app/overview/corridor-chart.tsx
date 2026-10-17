"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel, PanelHeader } from "@/components/ui/panel";
import Link from "next/link";
import { investigations } from "@/data/investigations";
import { isOpen, valueByCorridor } from "@/data/workspace";
import { formatMoney, formatMoneyCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { axisTick, ChartTooltipBox } from "../shared/chart-tooltip";

const largest = (corridor: string) =>
  investigations.filter((i) => isOpen(i) && i.corridor === corridor).sort((a, b) => b.invoice.stated_total - a.invoice.stated_total)[0];

const data = valueByCorridor().map((r) => ({ ...r, label: r.corridor.replace("-", " → ") }));
type Row = (typeof data)[number];

function TooltipBody({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <ChartTooltipBox
      title={`Corridor ${r.label}`}
      rows={[
        { label: "Invoiced value", value: formatMoney(r.value), swatch: "var(--accent)" },
        { label: "Open cases", value: String(r.cases) },
      ]}
    />
  );
}

/** Where the money under review sits. */
export function CorridorChart({ className }: { className?: string }) {
  const total = data.reduce((s, r) => s + r.value, 0);
  return (
    <Panel className={cn("flex flex-col", className)}>
      <PanelHeader title="Where is the value under review?" description="Invoiced value under open cases, by trade corridor" />
      <div className="px-4 pt-3">
        <p className="text-[12px] text-fg-subtle">Total under review</p>
        <p className="font-mono text-[18px] tabular text-fg">{formatMoney(total)}</p>
      </div>
      <div className="px-2 pb-3 pt-1" style={{ height: data.length * 40 + 16 }}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 420, height: data.length * 40 + 16 }}>
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 118, bottom: 0, left: 0 }} barCategoryGap="34%">
            <XAxis type="number" hide domain={[0, "dataMax"]} />
            <YAxis
              type="category"
              dataKey="label"
              width={70}
              tick={{ ...axisTick, fill: "var(--fg-muted)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border-strong)" }}
            />
            <Tooltip content={<TooltipBody />} cursor={{ fill: "var(--surface-2)" }} />
            <Bar dataKey="value" fill="var(--accent)" radius={[0, 3, 3, 0]} isAnimationActive={false} minPointSize={2}>
              <LabelList
                dataKey="value"
                position="right"
                content={(p) => {
                  const { x = 0, y = 0, width = 0, height = 0, index = 0 } = p as { x?: number; y?: number; width?: number; height?: number; index?: number };
                  const r = data[index];
                  return (
                    <text x={Number(x) + Number(width) + 6} y={Number(y) + Number(height) / 2} dominantBaseline="central" fontSize={11} fontFamily="var(--font-mono)">
                      <tspan fill="var(--fg)">{formatMoneyCompact(r.value).replace("USD ", "$")}</tspan>
                      <tspan fill="var(--fg-subtle)"> · {r.cases} {r.cases === 1 ? "case" : "cases"}</tspan>
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-auto border-t border-border">
        <p className="eyebrow px-4 pt-3">Largest open case per corridor</p>
        <ul className="divide-y divide-border pb-1">
          {data.map((r) => {
            const c = largest(r.corridor);
            return (
              <li key={r.corridor} className="relative flex items-baseline gap-3 px-4 py-2 text-[12.5px] hover:bg-surface-2">
                <span className="w-14 shrink-0 font-mono text-[11px] text-fg-subtle">{r.corridor}</span>
                <Link href={`/app/investigations/${c.id}`} className="min-w-0 flex-1 truncate text-fg after:absolute after:inset-0 hover:underline">
                  <span className="font-mono text-fg-muted">{c.id}</span> {c.commodity}
                </Link>
                <span className="shrink-0 font-mono tabular text-fg-muted">{formatMoneyCompact(c.invoice.stated_total)}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </Panel>
  );
}
