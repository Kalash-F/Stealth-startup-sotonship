import type { GraphEdge, GraphNode, Shipment, Transaction } from "./types";

export const shipments: Shipment[] = [
  {
    id: "SHP-0142",
    bill_of_lading: "NGBJEA2608114 / JEAFXT2608297",
    vessel: "MV Kestrel Bay / MV Solent Arrow (fictional)",
    legs: [
      { from: "Ningbo", fromCountry: "CN", to: "Jebel Ali", toCountry: "AE", departed: "2026-08-07", arrived: "2026-08-24" },
      { from: "Jebel Ali", fromCountry: "AE", to: "Felixstowe", toCountry: "GB", departed: "2026-08-29", arrived: "2026-09-21" },
    ],
    goods_description: "Fasteners, steel, zinc plated",
    gross_weight_kg: 2640,
    containers: "1 × 20' (TGHU 418372 6)",
  },
  {
    id: "SHP-0145",
    bill_of_lading: "JEAHAM2609061",
    vessel: "MV Arabian Lark (fictional)",
    legs: [
      { from: "Jebel Ali", fromCountry: "AE", to: "Hamburg", toCountry: "DE", departed: "2026-09-12", arrived: "2026-10-04" },
    ],
    goods_description: "Copper cathodes, bundled",
    gross_weight_kg: 50420,
    containers: "2 × 20' (MSKU 220913 4, MSKU 220977 1)",
  },
];

export const transactions: Transaction[] = [
  { id: "TX-1", ref: "PAY-26081200417", at: "2026-08-12", fromEntityId: "ent-calder", toEntityId: "ent-orchard", amount: 195950, currency: "USD", narrative: "INV OGT-INV-26-0311 50% ADVANCE", caseIds: ["CASE-0142"] },
  { id: "TX-2", ref: "PAY-26081400982", at: "2026-08-14", fromEntityId: "ent-orchard", toEntityId: "ent-vltava", amount: 182400, currency: "USD", narrative: "CONSULTANCY SERVICES Q3", caseIds: ["CASE-0142"] },
  { id: "TX-3", ref: "PAY-26090300228", at: "2026-09-03", fromEntityId: "ent-calder", toEntityId: "ent-orchard", amount: 195950, currency: "USD", narrative: "INV OGT-INV-26-0311 BALANCE", caseIds: ["CASE-0142"] },
  { id: "TX-4", ref: "PAY-26090500655", at: "2026-09-05", fromEntityId: "ent-orchard", toEntityId: "ent-yongjia", amount: 5180, currency: "USD", narrative: "PO 26-118 FASTENERS", caseIds: ["CASE-0142"] },
  { id: "TX-5", ref: "PAY-26090600713", at: "2026-09-06", fromEntityId: "ent-orchard", toEntityId: "ent-vltava", amount: 176900, currency: "USD", narrative: "CONSULTANCY SERVICES Q3", caseIds: ["CASE-0142"] },
  { id: "TX-6", ref: "PAY-26091500311", at: "2026-09-15", fromEntityId: "ent-vltava", toEntityId: "ent-copperline", amount: 110000, currency: "USD", narrative: "CLM-2609-044 CATHODES", caseIds: ["CASE-0145"] },
  { id: "TX-7", ref: "PAY-26073000146", at: "2026-07-30", fromEntityId: "ent-morava", toEntityId: "ent-orchard", amount: 2170000, currency: "USD", narrative: "OGT-INV-26-0207", caseIds: ["CASE-0139"] },
];

export const transactionsForCase = (caseId: string) => transactions.filter((t) => t.caseIds.includes(caseId));
export const transactionsForEntity = (entityId: string) =>
  transactions.filter((t) => t.fromEntityId === entityId || t.toEntityId === entityId);

/**
 * The Orchard Gate network. Positions are hand-laid so the pattern reads
 * left-to-right: goods come from the manufacturer, the intermediary invoices
 * the importer, and the money moves on to a related party.
 */
export const graphNodes: GraphNode[] = [
  { id: "n-yongjia", type: "entity", refId: "ent-yongjia", label: "Yongjia Hexa Fasteners", sublabel: "Manufacturer · CN", x: 0, y: 40 },
  { id: "n-shp", type: "shipment", refId: "SHP-0142", label: "SHP-0142", sublabel: "Ningbo → Jebel Ali → Felixstowe · 2,640 kg", x: 330, y: 0 },
  { id: "n-calder", type: "entity", refId: "ent-calder", label: "Calder Brook Industrial", sublabel: "Importer · GB", x: 980, y: 40 },
  { id: "n-inv0311", type: "invoice", refId: "OGT-INV-26-0311", label: "OGT-INV-26-0311", sublabel: "USD 391,900 · bolts @ $2.85", x: 690, y: 150, emphasis: "risk" },
  { id: "n-orchard", type: "entity", refId: "ent-orchard", label: "Orchard Gate General Trading", sublabel: "Intermediary · AE", x: 400, y: 250, emphasis: "focus" },
  { id: "n-pay-in", type: "payment", refId: "TX-1,TX-3", label: "2 payments", sublabel: "USD 391,900 · 12 Aug, 3 Sep", x: 760, y: 300 },
  { id: "n-pay-mfr", type: "payment", refId: "TX-4", label: "1 payment", sublabel: "USD 5,180 · 5 Sep", x: 0, y: 150 },
  { id: "n-pay-out", type: "payment", refId: "TX-2,TX-5", label: "2 payments", sublabel: "USD 359,300 · 14 Aug, 6 Sep", x: 400, y: 420, emphasis: "risk" },
  { id: "n-ferrant", type: "entity", refId: "ent-ferrant", label: "D. Ferrant", sublabel: "Beneficial owner", x: 0, y: 420 },
  { id: "n-vltava", type: "entity", refId: "ent-vltava", label: "Vltava Componenta", sublabel: "Related party · CZ", x: 400, y: 580, emphasis: "risk" },
  { id: "n-invclm", type: "invoice", refId: "CLM-2609-044", label: "CLM-2609-044", sublabel: "USD 110,000 · copper @ $2.20/kg", x: 720, y: 560 },
  { id: "n-copperline", type: "entity", refId: "ent-copperline", label: "Copperline Metals", sublabel: "Exporter · AE", x: 1000, y: 580 },
  { id: "n-inv0207", type: "invoice", refId: "OGT-INV-26-0207", label: "OGT-INV-26-0207", sublabel: "USD 2,170,000 · USB @ $310", x: -300, y: 250 },
  { id: "n-morava", type: "entity", refId: "ent-morava", label: "Morava Datatech", sublabel: "Importer · CZ", x: -300, y: 420, emphasis: "muted" },
];

export const graphEdges: GraphEdge[] = [
  { id: "e1", source: "n-yongjia", target: "n-shp", label: "ships goods", kind: "trade" },
  { id: "e2", source: "n-shp", target: "n-calder", label: "delivered to", kind: "trade" },
  { id: "e3", source: "n-orchard", target: "n-inv0311", label: "issues", kind: "document" },
  { id: "e4", source: "n-inv0311", target: "n-calder", label: "billed to", kind: "document", emphasis: "risk" },
  { id: "e5", source: "n-calder", target: "n-pay-in", label: "pays", kind: "money" },
  { id: "e6", source: "n-pay-in", target: "n-orchard", label: "received", kind: "money" },
  { id: "e7", source: "n-orchard", target: "n-pay-mfr", label: "pays", kind: "money" },
  { id: "e8", source: "n-pay-mfr", target: "n-yongjia", label: "received", kind: "money" },
  { id: "e9", source: "n-orchard", target: "n-pay-out", label: "pays on", kind: "money", emphasis: "risk" },
  { id: "e10", source: "n-pay-out", target: "n-vltava", label: "received", kind: "money", emphasis: "risk" },
  { id: "e11", source: "n-ferrant", target: "n-orchard", label: "owns", kind: "ownership", emphasis: "risk" },
  { id: "e12", source: "n-ferrant", target: "n-vltava", label: "owns", kind: "ownership", emphasis: "risk" },
  { id: "e13", source: "n-copperline", target: "n-invclm", label: "issues", kind: "document" },
  { id: "e14", source: "n-invclm", target: "n-vltava", label: "billed to", kind: "document" },
  { id: "e15", source: "n-orchard", target: "n-inv0207", label: "issues", kind: "document" },
  { id: "e16", source: "n-inv0207", target: "n-morava", label: "billed to", kind: "document" },
];
