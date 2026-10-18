import Link from "next/link";
import { CaseStatusLabel, PriorityBadge } from "@/components/domain/status";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { countries, entityById } from "@/data/reference";
import { investigationById } from "@/data/investigations";
import { entityKindLabel } from "../shared/entity-kind";
import type { Investigation } from "@/data/types";


/** Right-hand rail on wide screens, a section below the tabs elsewhere. */
export function CaseRail({ inv }: { inv: Investigation }) {
  const related = inv.relatedCaseIds.map((id) => investigationById(id)!).filter(Boolean);
  const ents = inv.entityIds.map((id) => entityById(id)!).filter(Boolean);
  return (
    <aside aria-label="Related cases and entities" className="grid content-start gap-4 md:grid-cols-2 xl:min-h-0 xl:grid-cols-1 xl:overflow-y-auto">
      <Panel>
        <PanelHeader title="Related cases" description={related.length ? undefined : "None linked"} />
        {related.length ? (
          <ul className="divide-y divide-border">
            {related.map((c) => (
              <li key={c.id} className="relative grid gap-1 px-4 py-2.5 hover:bg-surface-2">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/app/investigations/${c.id}`} className="font-mono text-small text-fg after:absolute after:inset-0 hover:underline">
                    {c.id}
                  </Link>
                  <PriorityBadge band={c.priority_band} score={c.priority_score} />
                </div>
                <p className="text-small leading-snug text-fg-muted">{c.title}</p>
                <CaseStatusLabel status={c.status} className="text-small" />
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>
      <Panel>
        <PanelHeader title="Involved entities" />
        <ul className="divide-y divide-border">
          {ents.map((e) => (
            <li key={e.id} className="relative px-4 py-2 hover:bg-surface-2">
              <Link href={`/app/entities?entity=${e.id}`} className="block truncate text-small text-fg after:absolute after:inset-0 hover:underline">
                {e.name}
              </Link>
              <p className="text-meta text-fg-subtle">
                {entityKindLabel[e.kind]} · {countries[e.country].short}
              </p>
            </li>
          ))}
        </ul>
      </Panel>
    </aside>
  );
}
