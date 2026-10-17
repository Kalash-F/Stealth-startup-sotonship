import Link from "next/link";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { recentActivity } from "@/data/workspace";
import { formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TimelineKindIcon } from "../shared/timeline-kind";

/** The latest evidence and case events across the workspace. */
export function ActivityFeed({ className, limit = 8 }: { className?: string; limit?: number }) {
  const items = recentActivity(limit);
  return (
    <Panel className={cn("flex flex-col", className)}>
      <PanelHeader title="Recent activity" description="Latest events across all cases" />
      <ol className="divide-y divide-border">
        {items.map((e) => (
          <li key={`${e.caseId}-${e.id}`} className="relative flex gap-3 px-4 py-2.5 hover:bg-surface-2">
            <TimelineKindIcon kind={e.kind} className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <Link
                  href={`/app/investigations/${e.caseId}`}
                  className="truncate text-[13px] text-fg after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus"
                >
                  {e.title}
                </Link>
                <time dateTime={e.at} className="shrink-0 font-mono text-[11px] tabular text-fg-subtle">
                  {formatDateShort(e.at)}
                </time>
              </div>
              <p className="truncate text-[12px] text-fg-muted">
                <span className="font-mono text-fg-subtle">{e.caseId}</span> · {e.detail}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
