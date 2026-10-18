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
  /** Render the screen at its desktop width and scale it down to fit, so narrow frames never clip it. */
  scaled?: boolean;
}

/** Below this width a screen lays out as it does on a tablet, then scales; above it, it renders 1:1. */
const MIN_DESIGN_WIDTH = 960;
const DESIGN_HEIGHT = 640;

/** A screen drawn at a fixed design size and scaled to the frame, like a live screenshot. */
function ScaledScreen({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [fit, setFit] = React.useState<{ width: number; scale: number } | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const available = entry.contentRect.width;
      const width = Math.max(available, MIN_DESIGN_WIDTH);
      setFit({ width, scale: available / width });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = fit?.scale ?? 1;
  return (
    <div ref={ref} className="relative overflow-hidden" style={{ height: DESIGN_HEIGHT * scale }}>
      <div
        className={cn("origin-top-left", !fit && "invisible")}
        style={{ width: fit?.width ?? "100%", height: DESIGN_HEIGHT, transform: `scale(${scale})` }}
      >
        {children}
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bg to-transparent" />
    </div>
  );
}

/** Editorial tab rail over one wide product window. Panels are real workspace components. */
export function ShowcaseTabs({ panels }: { panels: ShowcasePanel[] }) {
  const [value, setValue] = React.useState(panels[0].id);
  const current = panels.find((p) => p.id === value)!;
  return (
    <TabsPrimitive.Root value={value} onValueChange={setValue}>
      <TabsPrimitive.List aria-label="Workspace views" className="grid grid-cols-3 border-t border-border-strong">
        {panels.map((p, i) => (
          <TabsPrimitive.Trigger
            key={p.id}
            value={p.id}
            className={cn(
              "group relative -mt-px flex cursor-pointer flex-col items-start justify-start border-t-2 border-transparent py-4 pr-3 text-left transition-colors md:py-5 md:pr-6",
              "data-[state=active]:border-accent",
            )}
          >
            <span className="font-mono text-[11px] text-fg-subtle group-data-[state=active]:text-accent">0{i + 1}</span>
            <span className="mt-1.5 block text-[14px] font-medium text-fg-muted transition-colors group-hover:text-fg group-data-[state=active]:text-fg md:text-[17px]">
              {p.label}
            </span>
            <span className="mt-1 hidden max-w-[20rem] text-[13px] leading-snug text-fg-subtle md:block">{p.blurb}</span>
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      <div className="theme-ink relative mt-6 overflow-hidden rounded-lg border border-border-strong bg-bg text-fg shadow-frame md:mt-10">
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
          <TabsPrimitive.Content key={p.id} value={p.id} className="focus-visible:outline-none">
            {p.scaled ? (
              <ScaledScreen>
                <div className="p-4 md:p-6">{p.content}</div>
              </ScaledScreen>
            ) : (
              p.content
            )}
          </TabsPrimitive.Content>
        ))}
      </div>
    </TabsPrimitive.Root>
  );
}
