import { graphNodes } from "./network";
import type { GraphNode } from "./types";

/**
 * A compact three-column arrangement of the Orchard Gate network for the
 * workspace, where the graph shares the width with a detail panel. Same nodes
 * and edges as network.ts; only positions differ. Reads top to bottom:
 * goods and invoice, money into the intermediary, money out to the related
 * party and its own copper purchase.
 */
const ROW = 125;
const COL = 300;
const compact: Record<string, [col: number, row: number]> = {
  "n-yongjia": [0, 0],
  "n-shp": [1, 0],
  "n-calder": [2, 0],
  "n-pay-mfr": [0, 1],
  "n-inv0311": [1, 1],
  "n-pay-in": [2, 1],
  "n-inv0207": [0, 2],
  "n-orchard": [1, 2],
  "n-morava": [0, 3],
  "n-pay-out": [1, 3],
  "n-ferrant": [2, 3],
  "n-invclm": [0, 4],
  "n-vltava": [1, 4],
  "n-copperline": [0, 5],
};

export function compactLayout(nodes: GraphNode[] = graphNodes): GraphNode[] {
  return nodes.map((n) => {
    const p = compact[n.id];
    return p ? { ...n, x: p[0] * COL, y: p[1] * ROW } : n;
  });
}
