"use client";

import * as React from "react";
import { EntityDetail } from "@/components/app/entities/entity-detail";
import type { Selection } from "@/components/app/entities/use-selection";
import { EntityGraph, GraphLegend } from "@/components/domain/entity-graph";
import { entityById } from "@/data/reference";
import { graphEdges } from "@/data/network";
import { compactLayout } from "@/data/graph-layout";
import { nodeById, nodeForEntity } from "@/data/selectors";

function resolve(next: { entityId?: string; nodeId?: string } | null): Selection {
  if (!next) return null;
  if (next.entityId) {
    const entity = entityById(next.entityId);
    if (entity) return { kind: "entity", entity, node: nodeForEntity(entity.id) ?? null };
  }
  if (next.nodeId) {
    const node = nodeById(next.nodeId);
    if (node?.type === "entity") {
      const entity = entityById(node.refId);
      if (entity) return { kind: "entity", entity, node };
    }
    if (node) return { kind: "node", node };
  }
  return null;
}

const nodes = compactLayout();

/**
 * The workspace's network view: the real graph and the real detail panel.
 * It opens on the intermediary with the whole network visible; fading starts once someone selects a node.
 */
export function NetworkPreview() {
  const [selection, setSelection] = React.useState<Selection>(() => resolve({ entityId: "ent-orchard" }));
  const [touched, setTouched] = React.useState(false);
  const select = React.useCallback((next: { entityId?: string; nodeId?: string } | null) => {
    setTouched(true);
    setSelection(resolve(next));
  }, []);

  return (
    <div className="grid lg:h-[640px] lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col">
        <div className="h-[340px] sm:h-[520px] lg:h-auto lg:min-h-0 lg:flex-1">
          <EntityGraph
            nodes={nodes}
            edges={graphEdges}
            selectedId={selection?.node?.id ?? null}
            onSelect={(n) => select(n ? { nodeId: n.id } : null)}
            dimUnrelated={touched}
            attribution={false}
            interactive
            ariaLabel="Network of companies, invoices and payments around Orchard Gate."
          />
        </div>
        <div className="border-t border-border bg-surface px-4 py-3">
          <GraphLegend />
        </div>
      </div>
      <div className="min-w-0 border-t border-border max-lg:max-h-[440px] max-lg:overflow-y-auto lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-t-0">
        <EntityDetail selection={selection} select={select} className="rounded-none border-0" />
      </div>
    </div>
  );
}
