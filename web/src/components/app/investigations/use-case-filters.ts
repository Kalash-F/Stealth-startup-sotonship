"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { investigations } from "@/data/investigations";
import { caseSearchText } from "@/data/selectors";
import type { CaseStatus, Investigation, PriorityBand } from "@/data/types";

export type SortKey = "score" | "updated" | "value";
export type SortDir = "asc" | "desc";

export interface CaseFilters {
  q: string;
  status: CaseStatus | "";
  band: PriorityBand | "";
  corridor: string;
  sort: SortKey;
  dir: SortDir;
}

const DEFAULTS: CaseFilters = { q: "", status: "", band: "", corridor: "", sort: "score", dir: "desc" };

const sortValue: Record<SortKey, (i: Investigation) => number | string> = {
  score: (i) => i.priority_score,
  updated: (i) => i.updated,
  value: (i) => i.invoice.stated_total,
};

/** Filter and sort state that lives in the URL, so it survives reload and sharing. */
export function useCaseFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const urlFilters: CaseFilters = {
    q: params.get("q") ?? "",
    status: (params.get("status") as CaseStatus) ?? "",
    band: (params.get("band") as PriorityBand) ?? "",
    corridor: params.get("corridor") ?? "",
    sort: (["score", "updated", "value"].includes(params.get("sort") ?? "") ? params.get("sort") : "score") as SortKey,
    dir: params.get("dir") === "asc" ? "asc" : "desc",
  };

  // The search box is typed into locally and written to the URL, so typing stays responsive.
  const [q, setQLocal] = React.useState(urlFilters.q);
  const lastWritten = React.useRef(urlFilters.q);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    // Only follow the URL when it changed from outside (back button, a link), not from our own typing.
    if (urlFilters.q !== lastWritten.current) {
      lastWritten.current = urlFilters.q;
      setQLocal(urlFilters.q);
    }
  }, [urlFilters.q]);
  React.useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const write = React.useCallback(
    (next: Partial<CaseFilters>) => {
      const merged = { ...urlFilters, q, ...next };
      lastWritten.current = merged.q;
      const sp = new URLSearchParams();
      (Object.keys(merged) as (keyof CaseFilters)[]).forEach((k) => {
        const v = merged[k];
        if (v && v !== DEFAULTS[k]) sp.set(k, String(v));
      });
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params, q, pathname, router],
  );

  const setQ = (value: string) => {
    setQLocal(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => write({ q: value }), 200);
  };

  const filters = { ...urlFilters, q };
  const active = Boolean(filters.q || filters.status || filters.band || filters.corridor);

  const results = React.useMemo(() => {
    const term = filters.q.trim().toLowerCase();
    const rows = investigations.filter(
      (i) =>
        (!term || caseSearchText(i).includes(term)) &&
        (!filters.status || i.status === filters.status) &&
        (!filters.band || i.priority_band === filters.band) &&
        (!filters.corridor || i.corridor === filters.corridor),
    );
    const get = sortValue[filters.sort];
    const mult = filters.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      const c = typeof av === "number" ? av - (bv as number) : String(av).localeCompare(String(bv));
      return c * mult || b.updated.localeCompare(a.updated);
    });
  }, [filters.q, filters.status, filters.band, filters.corridor, filters.sort, filters.dir]);

  const toggleSort = (key: SortKey) => {
    if (filters.sort === key) write({ dir: filters.dir === "desc" ? "asc" : "desc" });
    else write({ sort: key, dir: "desc" });
  };

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    lastWritten.current = "";
    setQLocal("");
    router.replace(
      filters.sort !== "score" || filters.dir !== "desc" ? `${pathname}?sort=${filters.sort}&dir=${filters.dir}` : pathname,
      { scroll: false },
    );
  };

  return { filters, results, active, setQ, write, toggleSort, clear };
}
