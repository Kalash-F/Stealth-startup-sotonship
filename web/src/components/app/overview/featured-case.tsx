"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CaseStatusLabel, PriorityBadge } from "@/components/domain/status";
import { investigationById, featuredCaseId } from "@/data/investigations";
import { cn } from "@/lib/utils";

const slide = "motion-safe:transition-[transform,background-color,border-color] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]";

/**
 * The case the workspace is built around, pinned to the bottom-right corner.
 * The whole card opens it; route, figures and next action live on the case page.
 * Hiding slides it off the right edge and leaves a tab to bring it back.
 */
export function FeaturedCase() {
  const c = investigationById(featuredCaseId)!;
  const [hidden, setHidden] = React.useState(false);

  return (
    <>
      <section
        aria-labelledby="featured-heading"
        inert={hidden}
        className={cn(
          "group fixed bottom-4 right-4 z-20 w-[min(320px,calc(100vw-2rem))] rounded-lg border border-accent/45 bg-surface shadow-float hover:border-accent hover:bg-surface-2",
          slide,
          hidden && "translate-x-[calc(100%+1rem)]",
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border py-2 pl-4 pr-2">
          <p className="eyebrow !text-accent">Your case · next up</p>
          <div className="flex items-center gap-1">
            <span className="font-mono text-small text-fg-muted group-hover:text-fg">{c.id}</span>
            <button
              type="button"
              onClick={() => setHidden(true)}
              aria-label="Hide next case"
              className="relative z-[1] ml-1 rounded-xs p-1 text-fg-subtle hover:bg-surface-3 hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        </header>
        <div className="p-4">
          <h2 id="featured-heading" className="text-title font-semibold leading-snug tracking-[-0.01em] text-fg">
            <Link
              href={`/app/investigations/${c.id}`}
              className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus"
            >
              {c.title}
            </Link>
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <PriorityBadge band={c.priority_band} score={c.priority_score} />
            <CaseStatusLabel status={c.status} />
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={() => setHidden(false)}
        inert={!hidden}
        aria-label="Show next case"
        className={cn(
          "fixed bottom-4 right-0 z-20 flex items-center gap-1.5 rounded-l-md border border-r-0 border-accent/45 bg-surface py-2 pl-2 pr-3 text-small font-medium text-accent shadow-float hover:border-accent hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus",
          slide,
          !hidden && "translate-x-full",
        )}
      >
        <ChevronLeft className="size-4" aria-hidden />
        Next up
      </button>
    </>
  );
}
