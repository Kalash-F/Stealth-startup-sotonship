"use client";

import * as React from "react";
import { EntityGraph, GraphLegend } from "@/components/domain/entity-graph";
import { compactLayout } from "@/data/graph-layout";
import { graphEdges } from "@/data/network";
import { entities } from "@/data/reference";
import { cn } from "@/lib/utils";

const nodes = compactLayout();
import { EntityDetail } from "./entity-detail";
import { EntityDirectory } from "./entity-directory";
import { PatternCallout } from "./pattern-callout";
import { useSelection } from "./use-selection";

type View = "graph" | "directory";

/**
 * Graph and directory share one box (switched in its header) so the page fits one screen on
 * desktop. The directory scrolls inside the box; details stay on the right for either view.
 * On wide screens the callout moves to the top of the right column so the graph gets full height.
 */
export function EntityExplorer() {
  const { selection, selectedNodeId, select, invalid } = useSelection();
  const [view, setView] = React.useState<View>("graph");
  const detailRef = React.useRef<HTMLDivElement>(null);

  const selectFromDirectory = (entityId: string) => {
    select({ entityId });
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    detailRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] xl:min-h-0 xl:flex-1 xl:grid-rows-[auto_minmax(0,1fr)] [&>*]:min-w-0">
      <div className="lg:col-span-2 xl:col-span-1 xl:col-start-2 xl:row-start-1">
        <PatternCallout />
      </div>
      <section
        aria-labelledby="graph-heading"
        className="flex min-w-0 flex-col overflow-hidden rounded-md border border-border bg-surface xl:col-start-1 xl:row-span-2 xl:row-start-1"
      >
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3">
          <div>
            <h2 id="graph-heading" className="text-body font-semibold text-fg">
              {view === "graph" ? "Orchard Gate network" : "Entity directory"}
            </h2>
            <p className="text-small text-fg-muted">
              {view === "graph"
                ? "Select a node to see its records. Drag to pan; use the controls to zoom."
                : `${entities.length} fictional companies and people. Mapped ones also appear in the graph.`}
            </p>
          </div>
          <div role="group" aria-label="View" className="flex rounded-sm border border-border p-0.5">
            {(["graph", "directory"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-xs px-2.5 py-1 text-small font-medium capitalize transition-colors",
                  view === v ? "bg-surface-3 text-fg" : "text-fg-muted hover:text-fg",
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </header>
        {view === "graph" ? (
          <>
            <div className="h-[460px] sm:h-[600px] lg:h-[700px] xl:h-auto xl:min-h-0 xl:flex-1">
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
          </>
        ) : (
          <EntityDirectory
            selectedEntityId={selection?.kind === "entity" ? selection.entity.id : null}
            onSelect={selectFromDirectory}
            className="max-h-[700px] xl:max-h-none xl:min-h-0 xl:flex-1"
          />
        )}
      </section>
      <div ref={detailRef} className="scroll-mt-20 xl:col-start-2 xl:row-start-2 xl:min-h-0">
        <EntityDetail selection={selection} select={select} invalid={invalid} className="lg:max-h-[812px] lg:overflow-y-auto xl:max-h-full" />
      </div>
    </div>
  );
}
