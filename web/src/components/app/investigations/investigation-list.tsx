"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, FilterX, Search } from "lucide-react";
import { CaseStatusLabel, PriorityBadge } from "@/components/domain/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { investigations } from "@/data/investigations";
import { corridorOptions } from "@/data/selectors";
import type { CaseStatus, Investigation, PriorityBand } from "@/data/types";
import { bandLabel, statusLabel } from "@/data/workspace";
import { formatDateShort, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AnalystAvatar } from "../shared/analyst-avatar";
import { type SortKey, useCaseFilters } from "./use-case-filters";

const statuses = Object.keys(statusLabel) as CaseStatus[];
const bands = Object.keys(bandLabel) as PriorityBand[];

function SortHeader({
  label,
  k,
  sort,
  dir,
  onSort,
  align = "left",
}: {
  label: string;
  k: SortKey;
  sort: SortKey;
  dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort === k;
  const Icon = !active ? ArrowUpDown : dir === "desc" ? ArrowDown : ArrowUp;
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === "desc" ? "descending" : "ascending") : "none"}
      className={cn("px-3 py-2 font-medium", align === "right" && "text-right")}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn(
          "inline-flex items-center gap-1 rounded-xs uppercase tracking-[0.06em] hover:text-fg",
          active && "text-fg",
          align === "right" && "flex-row-reverse",
        )}
      >
        {label}
        <Icon className={cn("size-3", !active && "opacity-50")} aria-hidden />
        <span className="sr-only">{active ? `, sorted ${dir === "desc" ? "descending" : "ascending"}` : ", sortable"}</span>
      </button>
    </th>
  );
}

const parties = (i: Investigation) => `${i.invoice.seller.name} → ${i.invoice.buyer.name}`;

export function InvestigationList() {
  const { filters, results, active, setQ, write, toggleSort, clear } = useCaseFilters();

  return (
    <div className="flex flex-col gap-3 lg:min-h-0">
      <form
        role="search"
        aria-label="Filter investigations"
        onSubmit={(e) => e.preventDefault()}
        className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-end"
      >
        <div className="grid gap-1 md:min-w-64 md:flex-1">
          <label htmlFor="case-q" className="text-small text-fg-muted">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
            <Input
              id="case-q"
              type="search"
              value={filters.q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Case id, title, party, invoice, commodity"
              className="pl-8 text-body"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:flex md:items-end">
          <div className="grid gap-1">
            <label htmlFor="case-status" className="text-small text-fg-muted">
              Status
            </label>
            <NativeSelect id="case-status" value={filters.status} onChange={(e) => write({ status: e.target.value as CaseStatus | "" })} className="md:w-48">
              <option value="">Any status</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {statusLabel[s]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1">
            <label htmlFor="case-band" className="text-small text-fg-muted">
              Priority
            </label>
            <NativeSelect id="case-band" value={filters.band} onChange={(e) => write({ band: e.target.value as PriorityBand | "" })} className="md:w-36">
              <option value="">Any priority</option>
              {bands.map((b) => (
                <option key={b} value={b}>
                  {bandLabel[b]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1">
            <label htmlFor="case-corridor" className="text-small text-fg-muted">
              Corridor
            </label>
            <NativeSelect id="case-corridor" value={filters.corridor} onChange={(e) => write({ corridor: e.target.value })} className="md:w-36">
              <option value="">Any corridor</option>
              {corridorOptions.map((c) => (
                <option key={c} value={c}>
                  {c.replace("-", " → ")}
                </option>
              ))}
            </NativeSelect>
          </div>
          {active ? (
            <Button type="button" variant="ghost" size="sm" onClick={clear} className="h-9 self-end">
              <FilterX aria-hidden /> Clear
            </Button>
          ) : null}
        </div>
      </form>

      <p className="text-small text-fg-subtle" aria-live="polite">
        Showing <span className="font-mono tabular text-fg-muted">{results.length}</span> of{" "}
        <span className="font-mono tabular text-fg-muted">{investigations.length}</span> cases
        {active ? " matching the filters" : ""}
      </p>

      <div className="flex flex-col overflow-hidden rounded-md border border-border bg-surface lg:min-h-0">
        {results.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <FilterX className="size-6 text-fg-subtle" aria-hidden />
            <div>
              <h2 className="text-title font-semibold text-fg">No cases match these filters</h2>
              <p className="mt-1 text-body text-fg-muted">Try a different search term, or clear the filters to see all {investigations.length} cases.</p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={clear}>
              Clear filters
            </Button>
          </div>
        ) : (
          <>
            {/* Wide table, md and up */}
            <div className="hidden min-h-0 overflow-auto md:block">
              <table className="w-full min-w-[1040px] table-fixed text-body">
                <caption className="sr-only">Investigations. Column headers with buttons can be sorted.</caption>
                <colgroup>
                  <col className="w-[20%]" />
                  <col className="w-[16%]" />
                  <col className="w-[9.5%]" />
                  <col className="w-[9%]" />
                  <col className="w-[11%]" />
                  <col className="w-[13%]" />
                  <col className="w-[12%]" />
                  <col className="w-12" />
                  <col className="w-20" />
                </colgroup>
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border text-left text-meta uppercase tracking-[0.06em] text-fg-subtle">
                    <th scope="col" className="px-4 py-2 font-medium">Case</th>
                    <th scope="col" className="px-3 py-2 font-medium">Parties</th>
                    <th scope="col" className="px-3 py-2 font-medium">Route</th>
                    <th scope="col" className="px-3 py-2 font-medium">Commodity</th>
                    <SortHeader label="Value" k="value" sort={filters.sort} dir={filters.dir} onSort={toggleSort} align="right" />
                    <SortHeader label="Priority" k="score" sort={filters.sort} dir={filters.dir} onSort={toggleSort} />
                    <th scope="col" className="px-3 py-2 font-medium">Status</th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      <span className="sr-only">Assignee</span>
                    </th>
                    <SortHeader label="Updated" k="updated" sort={filters.sort} dir={filters.dir} onSort={toggleSort} align="right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {results.map((i) => (
                    <tr key={i.id} className={cn("relative align-top hover:bg-surface-2", i.status === "closed_nfa" && "text-fg-muted")}>
                      <td className="px-4 py-3">
                        <Link
                          href={`/app/investigations/${i.id}`}
                          className="block after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus"
                        >
                          <span className="font-mono text-small text-fg-muted">{i.id}</span>
                          <span className="block text-fg">{i.title}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-fg-muted">
                        <span className="block truncate text-fg" title={i.invoice.seller.name}>{i.invoice.seller.name}</span>
                        <span className="block truncate" title={i.invoice.buyer.name}>→ {i.invoice.buyer.name}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className="block font-mono text-small text-fg">{i.route}</span>
                        <span className="font-mono text-meta text-fg-subtle">{i.corridor}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="block text-fg">{i.commodity}</span>
                        <span className="font-mono text-meta text-fg-subtle">HS {i.hs6}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular text-fg">
                        {formatMoney(i.invoice.stated_total, i.invoice.currency)}
                        <span className="block text-meta text-fg-subtle">{i.invoice.invoice_id}</span>
                      </td>
                      <td className="px-3 py-3">
                        <PriorityBadge band={i.priority_band} score={i.priority_score} />
                      </td>
                      <td className="px-3 py-3">
                        <CaseStatusLabel status={i.status} className="items-start whitespace-normal [&_svg]:mt-0.5" />
                      </td>
                      <td className="px-2 py-3">
                        <AnalystAvatar id={i.assigneeId} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-small tabular text-fg-muted">
                        <time dateTime={i.updated}>{formatDateShort(i.updated)}</time>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Stacked rows, under md */}
            <ul className="divide-y divide-border md:hidden">
              {results.map((i) => (
                <li key={i.id} className="relative grid gap-2 px-4 py-3 hover:bg-surface-2">
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/app/investigations/${i.id}`}
                      className="font-mono text-small text-fg-muted after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus"
                    >
                      {i.id}
                      <span className="sr-only">: {i.title}</span>
                    </Link>
                    <PriorityBadge band={i.priority_band} score={i.priority_score} />
                  </div>
                  <p className="text-title leading-snug text-fg" aria-hidden>
                    {i.title}
                  </p>
                  <p className="truncate text-small text-fg-muted">{parties(i)}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-small">
                    <CaseStatusLabel status={i.status} className="text-small" />
                    <span className="font-mono tabular text-fg">{formatMoney(i.invoice.stated_total, i.invoice.currency)}</span>
                    <span className="whitespace-nowrap font-mono text-fg-subtle">{i.route}</span>
                  </div>
                  <div className="flex items-center justify-between text-small text-fg-subtle">
                    <span>{i.commodity}</span>
                    <span className="flex items-center gap-2">
                      <time dateTime={i.updated} className="font-mono tabular">
                        {formatDateShort(i.updated)}
                      </time>
                      <AnalystAvatar id={i.assigneeId} />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
