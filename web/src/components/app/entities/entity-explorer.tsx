"use client";

import * as React from "react";
import { EntityGraph, GraphLegend } from "@/components/domain/entity-graph";
import { compactLayout } from "@/data/graph-layout";
import { graphEdges } from "@/data/network";

const nodes = compactLayout();
import { EntityDetail } from "./entity-detail";
import { EntityDirectory } from "./entity-directory";
import { PatternCallout } from "./pattern-callout";
import { useSelection } from "./use-selection";

export function EntityExplorer() {
  const { selection, selectedNodeId, select, invalid } = useSelection();
  const detailRef = React.useRef<HTMLDivElement>(null);

  const selectFromDirectory = (entityId: string) => {
    select({ entityId });
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    detailRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className="grid gap-4 [&>*]:min-w-0">
      <PatternCallout />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] [&>*]:min-w-0">
        <section aria-labelledby="graph-heading" className="flex min-w-0 flex-col overflow-hidden rounded-md border border-border bg-surface">
          <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3">
            <div>
              <h2 id="graph-heading" className="text-[13px] font-semibold text-fg">
                Orchard Gate network
              </h2>
              <p className="text-xs text-fg-muted">Select a node to see its records. Drag to pan; use the controls to zoom.</p>
            </div>
          </header>
          <div className="h-[460px] sm:h-[600px] lg:h-[700px]">
            <EntityGraph
              nodes={nodes}
              edges={graphEdges}
              selectedId={selectedNodeId}
              onSelect={(n) => select(n ? { nodeId: n.id } : null)}
              ariaLabel="Entity network graph"
            />
          </div>
          <div className="border-t border-border px-4 py-2.5">
            <GraphLegend />
          </div>
        </section>
        <div ref={detailRef} className="scroll-mt-20">
          <EntityDetail selection={selection} select={select} invalid={invalid} className="lg:max-h-[812px] lg:overflow-y-auto" />
        </div>
      </div>
      <EntityDirectory selectedEntityId={selection?.kind === "entity" ? selection.entity.id : null} onSelect={selectFromDirectory} />
    </div>
  );
}
