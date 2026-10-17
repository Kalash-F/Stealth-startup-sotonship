"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { EntityDetail } from "@/components/app/entities/entity-detail";
import type { Selection } from "@/components/app/entities/use-selection";
import { EntityGraph, GraphLegend } from "@/components/domain/entity-graph";
import { entityById } from "@/data/reference";
import { graphEdges } from "@/data/network";
import { compactLayout } from "@/data/graph-layout";
import { nodeById, nodeForEntity } from "@/data/selectors";
import { cn } from "@/lib/utils";
import { Container, SectionIndex, displayClass } from "./primitives";

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

const chips = [
  { label: "Orchard Gate", sel: { entityId: "ent-orchard" } },
  { label: "Payments on · USD 359,300", sel: { nodeId: "n-pay-out" } },
  { label: "Vltava Componenta", sel: { entityId: "ent-vltava" } },
  { label: "D. Ferrant", sel: { entityId: "ent-ferrant" } },
  { label: "Invoice OGT-INV-26-0311", sel: { nodeId: "n-inv0311" } },
];

const nodes = compactLayout();

/** Section E · The network behind the transaction. The real graph and the real detail panel. */
export function NetworkSection() {
  const [selection, setSelection] = React.useState<Selection>(() => resolve({ entityId: "ent-ferrant" }));
  const select = React.useCallback((next: { entityId?: string; nodeId?: string } | null) => setSelection(resolve(next)), []);
  const selectedNodeId = selection?.node?.id ?? null;

  return (
    <section id="network" aria-labelledby="network-heading" className="theme-night scroll-mt-16 bg-bg py-20 text-fg md:py-28 lg:py-36">
      <Container>
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <SectionIndex n="04">The network behind the transaction</SectionIndex>
            <h2 id="network-heading" className={cn(displayClass, "mt-6 text-[2.6rem] sm:text-6xl lg:text-[5rem]")}>
              Two companies.
              <br />
              <em className="text-fg-muted">One owner.</em>
            </h2>
          </div>
          <p className="max-w-sm text-[16px] leading-relaxed text-fg-muted lg:col-span-4">
            Invoices, shipments, payments and owners are drawn as one network. Select a node: everything not directly connected to it
            falls away, and its records, cases and connections open beside it.
          </p>
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-2" role="group" aria-label="Jump to a node">
          <span className="mr-2 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-subtle">Start from</span>
          {chips.map((c) => {
            const on = c.sel.entityId ? selection?.kind === "entity" && selection.entity.id === c.sel.entityId : selectedNodeId === c.sel.nodeId;
            return (
              <button
                key={c.label}
                type="button"
                aria-pressed={on}
                onClick={() => select(c.sel)}
                className={cn(
                  "h-8 rounded-sm border px-3 text-[12.5px] transition-colors",
                  on ? "border-accent bg-accent-soft text-fg" : "border-border-strong text-fg-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </Container>

      {/* the canvas runs edge to edge on large screens */}
      <div className="mx-auto mt-6 max-w-[1600px] px-4 sm:px-6 lg:px-10">
        <div className="theme-ink grid overflow-hidden rounded-lg border border-border-strong bg-bg lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="relative min-w-0">
            <div className="h-[520px] sm:h-[620px] lg:h-[760px]">
              <EntityGraph
                nodes={nodes}
                edges={graphEdges}
                selectedId={selectedNodeId}
                onSelect={(n) => select(n ? { nodeId: n.id } : null)}
                interactive
                ariaLabel="Entity relationship graph for the Orchard Gate network. Fictional data."
              />
            </div>
            <div className="border-t border-border bg-surface px-4 py-3">
              <GraphLegend />
            </div>
          </div>
          <div className="min-w-0 border-t border-border lg:max-h-[809px] lg:overflow-y-auto lg:border-l lg:border-t-0">
            <EntityDetail selection={selection} select={select} className="rounded-none border-0" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-subtle">
          <span>Fictional network · drag to pan · pinch or use the controls to zoom</span>
          <Link href="/app/entities" className="inline-flex items-center gap-1 normal-case tracking-normal text-[12.5px] text-fg-muted hover:text-fg">
            Open the full network view <ArrowUpRight aria-hidden className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
