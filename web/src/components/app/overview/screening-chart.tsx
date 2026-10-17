"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SyntheticBadge } from "@/components/domain/synthetic-badge";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { screeningSeries } from "@/data/workspace";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { axisTick, ChartTooltipBox } from "../shared/chart-tooltip";

const data = screeningSeries.map((m) => ({
  month: m.month,
  label: "partial" in m && m.partial ? `${m.month}*` : m.month,
  partial: "partial" in m && !!m.partial,
  screened: m.screened,
  flagged: m.flagged,
  reviewNow: m.reviewNow,
  otherFlagged: m.flagged - m.reviewNow,
  rate: (m.flagged / m.screened) * 100,
}));

type Row = (typeof data)[number];

function TooltipBody({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <ChartTooltipBox
      title={r.partial ? `${r.month} (month to date)` : r.month}
      rows={[
        { label: "Screened", value: formatNumber(r.screened), swatch: "var(--fg-subtle)" },
        { label: "Flagged", value: formatNumber(r.flagged), swatch: "var(--fg-muted)" },
        { label: "of which review now", value: formatNumber(r.reviewNow), swatch: "var(--risk-high)" },
        { label: "Flag rate", value: `${r.rate.toFixed(1)}%` },
      ]}
    />
  );
}

const gridProps = { stroke: "var(--border)", strokeDasharray: "2 4", vertical: false } as const;
const margin = { top: 6, right: 4, bottom: 0, left: 0 };

/**
 * Two small multiples on a shared month axis rather than a dual-axis chart:
 * volumes screened (hundreds) and flags raised (tens) differ by an order of
 * magnitude and would distort each other on one scale.
 */
export function ScreeningChart({ className }: { className?: string }) {
  const last = data.filter((d) => !d.partial).at(-1)!;
  const avgRate = data.filter((d) => !d.partial).reduce((s, d) => s + d.rate, 0) / data.filter((d) => !d.partial).length;
  return (
    <Panel className={cn("flex flex-col", className)}>
      <PanelHeader
        title="Is screening raising more flags?"
        description="Invoices screened and flagged per month, whole portfolio"
        actions={<SyntheticBadge label="Synthetic series" />}
      />
      <div className="grid grid-cols-3 border-b border-border text-[12px]">
        <div className="border-r border-border px-4 py-2.5">
          <p className="text-fg-subtle">Screened in {last.month}</p>
          <p className="font-mono text-[15px] tabular text-fg">{formatNumber(last.screened)}</p>
        </div>
        <div className="border-r border-border px-4 py-2.5">
          <p className="text-fg-subtle">Flag rate {last.month}</p>
          <p className="font-mono text-[15px] tabular text-fg">{last.rate.toFixed(1)}%</p>
        </div>
        <div className="px-4 py-2.5">
          <p className="text-fg-subtle">5-month average</p>
          <p className="font-mono text-[15px] tabular text-fg">{avgRate.toFixed(1)}%</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 px-2 pb-2 pt-3">
        <p className="px-2 text-[11.5px] text-fg-muted">Invoices screened</p>
        <div className="min-h-[118px] flex-1">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 520, height: 118 }}>
            <BarChart data={data} margin={margin} syncId="screening" barCategoryGap="28%">
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" hide />
              <YAxis width={44} tick={axisTick} tickLine={false} axisLine={false} tickCount={3} tickFormatter={(v: number) => formatNumber(v)} />
              <Tooltip content={<TooltipBody />} cursor={{ fill: "var(--surface-2)" }} />
              <Bar dataKey="screened" name="Screened" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {data.map((d) => (
                  <Cell key={d.month} fill="var(--fg-subtle)" fillOpacity={d.partial ? 0.35 : 0.75} stroke={d.partial ? "var(--fg-subtle)" : undefined} strokeDasharray={d.partial ? "3 2" : undefined} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-1">
          <p className="text-[11.5px] text-fg-muted">Flagged for review</p>
          <ul className="flex gap-3 text-[11px] text-fg-muted">
            <li className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-[2px] bg-risk-high" aria-hidden /> Review now
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-[2px] bg-fg-muted" aria-hidden /> Review or low
            </li>
          </ul>
        </div>
        <div className="min-h-[118px] flex-1">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 520, height: 118 }}>
            <BarChart data={data} margin={margin} syncId="screening" barCategoryGap="28%">
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--border-strong)" }} />
              <YAxis width={44} tick={axisTick} tickLine={false} axisLine={false} tickCount={3} />
              <Tooltip content={<TooltipBody />} cursor={{ fill: "var(--surface-2)" }} />
              <Bar dataKey="reviewNow" stackId="f" name="Review now" isAnimationActive={false} stroke="var(--surface)" strokeWidth={1}>
                {data.map((d) => (
                  <Cell key={d.month} fill="var(--risk-high)" fillOpacity={d.partial ? 0.45 : 1} />
                ))}
              </Bar>
              <Bar dataKey="otherFlagged" stackId="f" name="Review or low" radius={[3, 3, 0, 0]} isAnimationActive={false} stroke="var(--surface)" strokeWidth={1}>
                {data.map((d) => (
                  <Cell key={d.month} fill="var(--fg-muted)" fillOpacity={d.partial ? 0.4 : 0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="px-2 pt-1 text-[11px] text-fg-subtle">
          * October is month to date (to 17 Oct). Only flagged invoices become cases, so these volumes exceed the case list.
        </p>
      </div>
    </Panel>
  );
}
