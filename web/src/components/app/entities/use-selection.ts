"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { entityById } from "@/data/reference";
import { nodeById, nodeForEntity } from "@/data/selectors";
import type { Entity, GraphNode } from "@/data/types";

export type Selection =
  | { kind: "entity"; entity: Entity; node: GraphNode | null }
  | { kind: "node"; node: GraphNode }
  | null;

function resolve(entityId: string | null, nodeId: string | null): Selection {
  if (entityId) {
    const entity = entityById(entityId);
    if (entity) return { kind: "entity", entity, node: nodeForEntity(entity.id) ?? null };
  }
  if (nodeId) {
    const node = nodeById(nodeId);
    if (node?.type === "entity") {
      const entity = entityById(node.refId);
      if (entity) return { kind: "entity", entity, node };
    }
    if (node) return { kind: "node", node };
  }
  return null;
}

/** Selected entity or graph node, mirrored to ?entity= / ?node= so it can be deep linked. */
export function useSelection() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selection = React.useMemo(() => resolve(params.get("entity"), params.get("node")), [params]);
  const invalid = Boolean((params.get("entity") || params.get("node")) && !selection);

  const select = React.useCallback(
    (next: { entityId?: string; nodeId?: string } | null) => {
      let qs = "";
      if (next?.entityId) qs = `?entity=${encodeURIComponent(next.entityId)}`;
      else if (next?.nodeId) {
        const n = nodeById(next.nodeId);
        qs = n?.type === "entity" ? `?entity=${encodeURIComponent(n.refId)}` : `?node=${encodeURIComponent(next.nodeId)}`;
      }
      router.replace(`${pathname}${qs}`, { scroll: false });
    },
    [router, pathname],
  );

  const selectedNodeId = selection?.node?.id ?? null;
  return { selection, selectedNodeId, select, invalid };
}
