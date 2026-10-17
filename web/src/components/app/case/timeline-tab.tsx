import { Badge } from "@/components/ui/badge";
import { Panel, PanelHeader } from "@/components/ui/panel";
import type { Investigation, TimelineEvent } from "@/data/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TimelineKindIcon, timelineKindMeta } from "../shared/timeline-kind";

type Ev = TimelineEvent & { session?: true };

const time = (iso: string) => `${iso.slice(11, 16)} UTC`;

/** Evidence timeline, oldest first so the story reads in order. */
export function TimelineTab({ inv, sessionEvents }: { inv: Investigation; sessionEvents: Ev[] }) {
  const events: Ev[] = [...inv.timeline, ...sessionEvents].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <Panel>
      <PanelHeader title="Evidence timeline" description={`${events.length} events, oldest first. References link documents, alerts and payments.`} />
      <ol className="relative px-4 py-4">
        {events.map((e, idx) => (
          <li key={e.id} className="relative grid grid-cols-[24px_minmax(0,1fr)] gap-x-3 pb-5 last:pb-0 sm:grid-cols-[112px_24px_minmax(0,1fr)]">
            <div className="hidden pt-0.5 text-right sm:block">
              <time dateTime={e.at} className="block font-mono text-[12px] tabular text-fg">{formatDate(e.at)}</time>
              <span className="font-mono text-[11px] tabular text-fg-subtle">{time(e.at)}</span>
            </div>
            <div className="relative flex justify-center">
              {idx < events.length - 1 ? <span className="absolute bottom-[-20px] top-7 w-px bg-border" aria-hidden /> : null}
              <TimelineKindIcon kind={e.kind} className={cn(e.session && "border-accent/60")} />
            </div>
            <div className="min-w-0 pt-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="text-[13px] font-medium text-fg">{e.title}</h3>
                <span className="text-[11px] text-fg-subtle">{timelineKindMeta[e.kind].label}</span>
                {e.session ? <Badge tone="accent">This session · not saved</Badge> : null}
              </div>
              <time dateTime={e.at} className="font-mono text-[11px] tabular text-fg-subtle sm:hidden">
                {formatDate(e.at)}, {time(e.at)}
              </time>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-muted">{e.detail}</p>
              {e.ref ? (
                <p className="mt-1">
                  <span className="rounded-xs border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-fg-muted">{e.ref}</span>
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
