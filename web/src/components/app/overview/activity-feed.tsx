"use client";

import Link from "next/link";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { recentActivity } from "@/data/workspace";
import { formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useLiveVersion } from "@/lib/live-cases";
import { TimelineKindIcon } from "../shared/timeline-kind";

/** The latest evidence and case events across the workspace. */
export function ActivityFeed({ className, limit = 8, withHeader = true }: { className?: string; limit?: number; withHeader?: boolean }) {
  useLiveVersion();
  const items = recentActivity(limit);
  return (
    <Panel className={cn("flex flex-col", className)}>
      {withHeader ? <PanelHeader title="Recent activity" description="Latest events across all cases" /> : null}
      <ol className="min-h-0 divide-y divide-border overflow-y-auto">
        {items.map((e) => (
          <li key={`${e.caseId}-${e.id}`} className="relative flex gap-3 px-4 py-2.5 hover:bg-surface-2">
            <TimelineKindIcon kind={e.kind} className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <Link
                  href={`/app/investigations/${e.caseId}`}
                  className="truncate text-body text-fg after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus"
                >
                  {e.title}
                </Link>
                <time dateTime={e.at} className="shrink-0 font-mono text-meta tabular text-fg-subtle">
                  {formatDateShort(e.at)}
                </time>
              </div>
              <p className="truncate text-small text-fg-muted">
                <span className="font-mono text-fg-subtle">{e.caseId}</span> · {e.detail}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
