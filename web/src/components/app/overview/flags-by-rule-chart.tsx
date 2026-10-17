"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { rules } from "@/data/reference";
import { flagsByRule } from "@/data/workspace";
import { cn } from "@/lib/utils";
import { axisTick, ChartTooltipBox } from "../shared/chart-tooltip";

const data = flagsByRule();
const severities = [
  { key: "high", label: "High", color: "var(--risk-high)", glyph: "▲" },
  { key: "medium", label: "Medium", color: "var(--risk-review)", glyph: "■" },
  { key: "low", label: "Low", color: "var(--fg-subtle)", glyph: "●" },
] as const;

type Row = (typeof data)[number];

function TooltipBody({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <ChartTooltipBox
      title={rules[r.rule].name}
      rows={[
        ...severities.filter((s) => r[s.key] > 0).map((s) => ({ label: s.label, value: String(r[s.key]), swatch: s.color })),
        { label: "Total", value: String(r.total) },
      ]}
    />
  );
}

/** Which rules are doing the work, and at what severity. */
export function FlagsByRuleChart({ className }: { className?: string }) {
  const total = data.reduce((s, r) => s + r.total, 0);
  return (
    <Panel className={cn("flex flex-col", className)}>
      <PanelHeader
        title="Which rules raise the flags?"
        description={`${total} flags across every case in the workspace, by rule and severity`}
      />
      <div className="flex flex-1 flex-col px-2 pb-3 pt-2">
        <ul className="mb-1 flex gap-4 px-2 text-[11px] text-fg-muted" aria-label="Severity legend">
          {severities.map((s) => (
            <li key={s.key} className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-[2px]" style={{ background: s.color }} aria-hidden />
              {s.label}
            </li>
          ))}
        </ul>
        <div className="flex-1" style={{ minHeight: data.length * 34 + 28 }}>
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 480, height: data.length * 34 + 28 }}>
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }} barCategoryGap="30%">
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--border-strong)" }} />
              <YAxis
                type="category"
                dataKey="label"
                width={92}
                tick={{ ...axisTick, fill: "var(--fg-muted)", fontFamily: "var(--font-sans)", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<TooltipBody />} cursor={{ fill: "var(--surface-2)" }} />
              {severities.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  stackId="sev"
                  name={s.label}
                  fill={s.color}
                  stroke="var(--surface)"
                  strokeWidth={1}
                  radius={i === severities.length - 1 ? [0, 3, 3, 0] : 0}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="px-2 pt-2 text-[11px] text-fg-subtle">
          A case usually carries several flags. Priority is the sum of severity weights (high 40, medium 15, low 5), capped at 100.
        </p>
      </div>
    </Panel>
  );
}
