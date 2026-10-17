"use client";

import * as React from "react";
import Link from "next/link";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ShowcasePanel {
  id: string;
  label: string;
  blurb: string;
  crumbs: string[];
  href: string;
  content: React.ReactNode;
}

/** Large editorial tab rail over one wide product window. Panels are real workspace components. */
export function ShowcaseTabs({ panels }: { panels: ShowcasePanel[] }) {
  const [value, setValue] = React.useState(panels[0].id);
  const current = panels.find((p) => p.id === value)!;
  return (
    <TabsPrimitive.Root value={value} onValueChange={setValue}>
      <TabsPrimitive.List aria-label="Workspace views" className="grid grid-cols-2 border-t border-border-strong md:grid-cols-4">
        {panels.map((p, i) => (
          <TabsPrimitive.Trigger
            key={p.id}
            value={p.id}
            className={cn(
              "group relative -mt-px border-t-2 border-transparent py-4 pr-4 text-left transition-colors md:py-5",
              "data-[state=active]:border-accent",
            )}
          >
            <span className="font-mono text-[11px] text-fg-subtle group-data-[state=active]:text-accent">0{i + 1}</span>
            <span className="mt-1.5 block text-[15px] font-medium text-fg-muted transition-colors group-hover:text-fg group-data-[state=active]:text-fg md:text-[17px]">
              {p.label}
            </span>
            <span className="mt-1 hidden max-w-[16rem] text-[13px] leading-snug text-fg-subtle md:block">{p.blurb}</span>
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      <div className="relative mt-8 md:mt-12">
        {/* a second window behind, for depth */}
        <div aria-hidden className="absolute -right-3 -top-3 hidden h-full w-[92%] rounded-lg border border-border bg-surface/60 md:block lg:-right-6 lg:-top-6" />
        <div className="relative overflow-hidden rounded-lg border border-border-strong bg-bg shadow-frame">
          <div className="flex h-10 items-center justify-between gap-3 border-b border-border bg-surface px-4">
            <div className="flex min-w-0 items-center gap-3">
              <span aria-hidden className="flex gap-1.5">
                <span className="size-2 rounded-full bg-border-strong" />
                <span className="size-2 rounded-full bg-border-strong" />
                <span className="size-2 rounded-full bg-border-strong" />
              </span>
              <p className="truncate font-mono text-[11px] text-fg-subtle">
                {current.crumbs.map((c, i) => (
                  <React.Fragment key={c}>
                    {i > 0 ? <span aria-hidden> / </span> : null}
                    <span className={i === current.crumbs.length - 1 ? "text-fg-muted" : ""}>{c}</span>
                  </React.Fragment>
                ))}
              </p>
            </div>
            <Link href={current.href} className="inline-flex shrink-0 items-center gap-1 text-[12px] text-fg-muted hover:text-fg">
              Open this screen <ArrowUpRight aria-hidden className="size-3.5" />
            </Link>
          </div>
          {panels.map((p) => (
            <TabsPrimitive.Content key={p.id} value={p.id} forceMount className="data-[state=inactive]:hidden focus-visible:outline-none">
              <div className="relative h-[560px] overflow-hidden md:h-[640px]">
                <div className="p-4 md:p-6">{p.content}</div>
                <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-bg to-transparent" />
              </div>
            </TabsPrimitive.Content>
          ))}
        </div>
      </div>
    </TabsPrimitive.Root>
  );
}
