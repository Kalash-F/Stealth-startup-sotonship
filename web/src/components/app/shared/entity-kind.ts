import type { EntityKind } from "@/data/types";

export const entityKindLabel: Record<EntityKind, string> = {
  exporter: "Exporter",
  importer: "Importer",
  intermediary: "Intermediary",
  manufacturer: "Manufacturer",
  owner: "Beneficial owner",
  consignee: "Consignee",
};
