"use client";

import * as React from "react";
import { EntityGraph, GraphLegend } from "@/components/domain/entity-graph";
import { entityById } from "@/data/reference";
import { graphEdges, graphNodes } from "@/data/network";

// The Morava Datatech branch sits far to the left; leaving it out lets the core pattern render larger.
const hidden = new Set(["n-inv0207", "n-morava"]);
const nodes = graphNodes.filter((n) => !hidden.has(n.id));
const edges = graphEdges.filter((e) => !hidden.has(e.source) && !hidden.has(e.target));
import type { GraphNode } from "@/data/types";

/** Interactive graph with a one-line caption for the selected node. */
export function NetworkGraph() {
  const [selected, setSelected] = React.useState<GraphNode | null>(null);
  const entity = selected?.type === "entity" ? entityById(selected.refId) : null;

  return (
    <div>
      <div className="h-[460px] bg-bg sm:h-[560px] lg:h-[620px]">
        <EntityGraph
          nodes={nodes}
          edges={edges}
          selectedId={selected?.id ?? null}
          onSelect={setSelected}
          interactive
          ariaLabel="Entity relationship graph for the Orchard Gate network. Fictional data."
        />
      </div>
      <div className="flex min-h-[4.5rem] flex-col gap-3 border-t border-border bg-surface px-5 py-3 md:flex-row md:items-center md:justify-between" aria-live="polite">
        <div className="min-w-0 text-[13px]">
          {selected ? (
            <>
              <p className="font-semibold text-fg">
                {selected.label} <span className="font-normal text-fg-muted">· {selected.sublabel}</span>
              </p>
              {entity ? <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{entity.riskNote}</p> : null}
            </>
          ) : (
            <p className="text-fg-muted">Select any node to dim everything except its direct connections. Drag to pan.</p>
          )}
        </div>
        <GraphLegend className="shrink-0 md:max-w-[28rem] md:justify-end" />
      </div>
    </div>
  );
}
