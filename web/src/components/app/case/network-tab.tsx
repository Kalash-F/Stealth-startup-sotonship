"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EntityGraph, GraphLegend } from "@/components/domain/entity-graph";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { countries, entityById } from "@/data/reference";
import { compactLayout } from "@/data/graph-layout";
import { graphExcerptForCase } from "@/data/selectors";
import { entityKindLabel } from "../shared/entity-kind";
import type { GraphNode, Investigation } from "@/data/types";


function hrefFor(n: GraphNode) {
  return n.type === "entity" ? `/app/entities?entity=${n.refId}` : `/app/entities?node=${n.id}`;
}

export function NetworkTab({ inv }: { inv: Investigation }) {
  const excerpt = React.useMemo(() => {
    const e = graphExcerptForCase(inv);
    return e ? { ...e, nodes: compactLayout(e.nodes) } : null;
  }, [inv]);
  const [selected, setSelected] = React.useState<GraphNode | null>(null);
  const involved = inv.entityIds.map((id) => entityById(id)!).filter(Boolean);

  return (
    <div className="grid gap-4">
      {excerpt ? (
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Network excerpt"
            description="The part of the Orchard Gate network tied to this case. Select a node to highlight its connections."
            actions={
              <Link href="/app/entities" className="text-[12px] text-fg-muted hover:text-fg">
                Full network
              </Link>
            }
          />
          <div className="h-[440px] border-b border-border sm:h-[560px]">
            <EntityGraph
              nodes={excerpt.nodes}
              edges={excerpt.edges}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
              ariaLabel={`Network excerpt for ${inv.id}`}
            />
          </div>
          <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <GraphLegend />
            <div className="min-h-8 text-[12.5px]" aria-live="polite">
              {selected ? (
                <Link href={hrefFor(selected)} className="inline-flex items-center gap-1.5 text-accent hover:underline">
                  Open {selected.label} in Entities <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              ) : (
                <span className="text-fg-subtle">No node selected</span>
              )}
            </div>
          </div>
        </Panel>
      ) : (
        <Panel>
          <PanelHeader title="Network" description="This case does not form a connected excerpt of the mapped network." />
          <p className="px-4 py-3 text-[13px] text-fg-muted">
            {inv.relatedCaseIds.length
              ? `Related cases (${inv.relatedCaseIds.join(", ")}) may show the wider pattern.`
              : "No related cases have been linked."}{" "}
            The involved parties are listed below.
          </p>
        </Panel>
      )}

      <Panel>
        <PanelHeader title="Involved entities" description={`${involved.length} parties named on documents, payments or registry extracts`} />
        <ul className="divide-y divide-border">
          {involved.map((e) => (
            <li key={e.id} className="relative flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-2">
              <div className="min-w-0">
                <Link href={`/app/entities?entity=${e.id}`} className="block truncate text-[13px] text-fg after:absolute after:inset-0 hover:underline">
                  {e.name}
                </Link>
                <p className="truncate text-[12px] text-fg-muted">
                  {entityKindLabel[e.kind]} · {e.city}, {countries[e.country].name}
                </p>
              </div>
              <span className="shrink-0 font-mono text-[11px] text-fg-subtle">{e.caseIds.length} {e.caseIds.length === 1 ? "case" : "cases"}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
