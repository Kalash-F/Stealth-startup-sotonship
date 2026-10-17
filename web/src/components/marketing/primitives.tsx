import * as React from "react";
import { cn } from "@/lib/utils";

/** Page-width container shared by every marketing section. */
export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-10", className)} {...props} />;
}

/** Vertical rhythm: 64px on mobile, 96–128px on desktop. */
export const sectionY = "py-16 md:py-24 lg:py-28";

export function SectionHeading({
  eyebrow,
  id,
  children,
  className,
}: {
  eyebrow: string;
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="eyebrow">{eyebrow}</p>
      <h2
        id={id}
        className="mt-4 text-balance font-serif text-[2.25rem] font-normal leading-[1.04] tracking-[-0.015em] text-fg sm:text-5xl lg:text-[3.5rem]"
      >
        {children}
      </h2>
    </div>
  );
}

/**
 * A product window: dark workspace theme, thin title bar with breadcrumbs.
 * Real product components render inside it.
 */
export function ProductFrame({
  crumbs,
  right,
  children,
  className,
  bodyClassName,
  label,
}: {
  crumbs: string[];
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("theme-ink min-w-0 max-w-full overflow-hidden rounded-lg border border-border-strong bg-bg text-fg shadow-frame", className)}
    >
      <div className="flex h-10 items-center justify-between gap-3 border-b border-border bg-surface px-4">
        <nav aria-label="Breadcrumb in product preview" className="flex min-w-0 items-center gap-1.5 font-mono text-[11px] text-fg-subtle">
          {crumbs.map((c, i) => (
            <React.Fragment key={c}>
              {i > 0 ? <span aria-hidden>/</span> : null}
              <span className={cn("truncate", i === crumbs.length - 1 && "text-fg-muted")}>{c}</span>
            </React.Fragment>
          ))}
        </nav>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

/** Small mono key/value used inside frames. */
export function Fact({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="font-mono text-2xs uppercase tracking-[0.06em] text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-fg">{children}</dd>
    </div>
  );
}
