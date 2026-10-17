"use client";

import * as React from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  MarkerType,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Banknote, Building2, Factory, FileText, Repeat2, Ship, UserRound } from "lucide-react";
import { entityById } from "@/data/reference";
import type { EntityKind, GraphEdge, GraphNode } from "@/data/types";
import { cn } from "@/lib/utils";

const NODE_W = 208;
const NODE_H = 58;

const kindIcon: Record<EntityKind, typeof Building2> = {
  exporter: Building2,
  importer: Building2,
  consignee: Building2,
  manufacturer: Factory,
  intermediary: Repeat2,
  owner: UserRound,
};

type NodeData = GraphNode & { dimmed: boolean; selected: boolean } & Record<string, unknown>;

function iconFor(n: GraphNode) {
  if (n.type === "invoice") return FileText;
  if (n.type === "shipment") return Ship;
  if (n.type === "payment") return Banknote;
  const e = entityById(n.refId);
  return e ? kindIcon[e.kind] : Building2;
}

const typeLabel: Record<GraphNode["type"], string> = {
  entity: "Entity",
  invoice: "Invoice",
  shipment: "Shipment",
  payment: "Payments",
};

function GraphNodeView({ data }: NodeProps<Node<NodeData>>) {
  const Icon = iconFor(data);
  const isEntity = data.type === "entity";
  return (
    <div
      className={cn(
        "relative flex items-center gap-2.5 border bg-surface px-3 text-left transition-opacity",
        isEntity ? "rounded-md" : "rounded-xs border-dashed",
        data.emphasis === "focus" && "border-accent ring-1 ring-accent/40",
        data.emphasis === "risk" && "border-risk-high/70",
        data.emphasis === "muted" && "opacity-75",
        !data.emphasis && "border-border-strong",
        data.selected && "ring-2 ring-accent",
        data.dimmed && "opacity-30",
      )}
      style={{ width: NODE_W, height: NODE_H }}
    >
      {(["Top", "Right", "Bottom", "Left"] as const).map((side) => (
        <React.Fragment key={side}>
          <Handle id={`s-${side}`} type="source" position={Position[side]} className="!size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent" />
          <Handle id={`t-${side}`} type="target" position={Position[side]} className="!size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent" />
        </React.Fragment>
      ))}
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-xs",
          data.emphasis === "risk" ? "bg-risk-high-soft text-risk-high" : data.emphasis === "focus" ? "bg-accent-soft text-accent" : "bg-surface-2 text-fg-muted",
        )}
      >
        <Icon className="size-3.5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className={cn("block truncate text-[12px] font-semibold leading-tight text-fg", !isEntity && "font-mono font-medium")}>
          {data.label}
        </span>
        <span className="block truncate text-[10.5px] leading-tight text-fg-muted">{data.sublabel}</span>
      </span>
      <span className="sr-only">{typeLabel[data.type]}</span>
    </div>
  );
}

const nodeTypes = { graph: GraphNodeView };

/** Choose the facing sides of two nodes so edges never cross through a node. */
function handlesFor(a: GraphNode, b: GraphNode) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) * 0.55 > Math.abs(dy)) {
    return dx > 0 ? { sourceHandle: "s-Right", targetHandle: "t-Left" } : { sourceHandle: "s-Left", targetHandle: "t-Right" };
  }
  return dy > 0 ? { sourceHandle: "s-Bottom", targetHandle: "t-Top" } : { sourceHandle: "s-Top", targetHandle: "t-Bottom" };
}

export interface EntityGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId?: string | null;
  onSelect?: (node: GraphNode | null) => void;
  /** Static mode for marketing previews: no pan/zoom, no controls. */
  interactive?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function EntityGraph({ nodes, edges, selectedId = null, onSelect, interactive = true, className, ariaLabel }: EntityGraphProps) {
  const byId = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const neighbours = React.useMemo(() => {
    if (!selectedId) return null;
    const set = new Set([selectedId]);
    for (const e of edges) {
      if (e.source === selectedId) set.add(e.target);
      if (e.target === selectedId) set.add(e.source);
    }
    return set;
  }, [selectedId, edges]);

  const rfNodes: Node<NodeData>[] = React.useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: "graph",
        position: { x: n.x, y: n.y },
        data: { ...n, dimmed: neighbours ? !neighbours.has(n.id) : false, selected: n.id === selectedId },
        draggable: false,
        connectable: false,
        selectable: interactive,
        focusable: interactive,
        ariaLabel: `${typeLabel[n.type]}: ${n.label}, ${n.sublabel}`,
      })),
    [nodes, neighbours, selectedId, interactive],
  );

  const rfEdges: Edge[] = React.useMemo(
    () =>
      edges.map((e) => {
        const a = byId.get(e.source)!;
        const b = byId.get(e.target)!;
        const risk = e.emphasis === "risk";
        const active = neighbours ? neighbours.has(e.source) && neighbours.has(e.target) : true;
        const color = risk ? "var(--risk-high)" : e.kind === "money" ? "var(--accent)" : "var(--border-strong)";
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          ...handlesFor(a, b),
          type: "smoothstep",
          label: e.label,
          labelStyle: { fill: "var(--fg-muted)", fontSize: 10, fontFamily: "var(--font-mono)" },
          labelBgStyle: { fill: "var(--surface)" },
          labelBgPadding: [4, 2] as [number, number],
          style: {
            stroke: color,
            strokeWidth: risk ? 1.75 : 1.25,
            strokeDasharray: e.kind === "ownership" ? "4 3" : undefined,
            opacity: active ? 1 : 0.15,
          },
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
          focusable: false,
        };
      }),
    [edges, byId, neighbours],
  );

  return (
    <div className={cn("relative h-full w-full", className)} aria-label={ariaLabel} role="group">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.3}
        maxZoom={1.6}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={interactive}
        panOnDrag={interactive}
        zoomOnScroll={false}
        zoomOnPinch={interactive}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        onNodeClick={(_, n) => onSelect?.(byId.get(n.id) ?? null)}
        onPaneClick={() => onSelect?.(null)}
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--border)" />
        {interactive ? <Controls showInteractive={false} position="bottom-right" /> : null}
      </ReactFlow>
    </div>
  );
}

export function GraphLegend({ className }: { className?: string }) {
  const item = "inline-flex items-center gap-1.5";
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-fg-muted", className)}>
      <li className={item}>
        <span className="inline-block h-3 w-4 rounded-[3px] border border-border-strong bg-surface" aria-hidden /> Entity
      </li>
      <li className={item}>
        <span className="inline-block h-3 w-4 rounded-[1px] border border-dashed border-border-strong bg-surface" aria-hidden /> Document or payment
      </li>
      <li className={item}>
        <span className="inline-block h-px w-5 bg-accent" aria-hidden /> Money
      </li>
      <li className={item}>
        <span className="inline-block h-px w-5 bg-border-strong" aria-hidden /> Goods or document
      </li>
      <li className={item}>
        <span className="inline-block w-5 border-t border-dashed border-fg-muted" aria-hidden /> Ownership
      </li>
      <li className={item}>
        <span className="inline-block h-0.5 w-5 bg-risk-high" aria-hidden /> Under review
      </li>
    </ul>
  );
}
