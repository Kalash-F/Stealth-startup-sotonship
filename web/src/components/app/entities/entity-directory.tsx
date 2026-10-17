"use client";

import { Panel, PanelHeader } from "@/components/ui/panel";
import { countries, entities } from "@/data/reference";
import { casesForEntity, nodeForEntity } from "@/data/selectors";
import { cn } from "@/lib/utils";
import { entityKindLabel } from "../shared/entity-kind";

export function EntityDirectory({ selectedEntityId, onSelect }: { selectedEntityId: string | null; onSelect: (entityId: string) => void }) {
  const rows = [...entities].sort((a, b) => Number(!nodeForEntity(a.id)) - Number(!nodeForEntity(b.id)) || a.name.localeCompare(b.name));
  return (
    <Panel>
      <PanelHeader title="Entity directory" description={`${entities.length} fictional companies and people in the workspace. Mapped entities appear in the graph above.`} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <caption className="sr-only">All entities. Select a name to open its details.</caption>
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.06em] text-fg-subtle">
              <th scope="col" className="px-4 py-2 font-medium">Name</th>
              <th scope="col" className="px-3 py-2 font-medium">Kind</th>
              <th scope="col" className="px-3 py-2 font-medium">Country</th>
              <th scope="col" className="px-3 py-2 font-medium">In graph</th>
              <th scope="col" className="px-4 py-2 font-medium">Cases</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((e) => {
              const selected = e.id === selectedEntityId;
              const inGraph = Boolean(nodeForEntity(e.id));
              return (
                <tr key={e.id} className={cn("relative hover:bg-surface-2", selected && "bg-surface-3 hover:bg-surface-3")} aria-selected={selected}>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => onSelect(e.id)}
                      aria-pressed={selected}
                      className="text-left text-fg after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus"
                    >
                      {selected ? <span className="mr-1.5 text-accent" aria-hidden>▸</span> : null}
                      {e.name}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-fg-muted">{entityKindLabel[e.kind]}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-fg-muted">
                    <span className="font-mono text-[12px] text-fg">{e.country}</span> {e.city}
                    <span className="sr-only">, {countries[e.country].name}</span>
                  </td>
                  <td className="px-3 py-2 text-[12px] text-fg-muted">{inGraph ? <span className="text-accent">● Mapped</span> : <span className="text-fg-subtle">○ Not mapped</span>}</td>
                  <td className="px-4 py-2 font-mono text-[12px] text-fg-muted">{casesForEntity(e.id).map((c) => c.id).join(", ")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
