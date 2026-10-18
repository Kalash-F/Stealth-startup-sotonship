import * as React from "react";
import { cn } from "@/lib/utils";

/** Page-width container shared by every marketing section. */
export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-10", className)} {...props} />;
}

/** "01 — Product": section index and name, with a short rule. */
export function SectionIndex({ n, children, className }: { n: string; children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-center gap-3 text-[13px] font-medium text-fg-subtle", className)}>
      <span className="tabular text-accent">{n}</span>
      <span aria-hidden className="h-px w-8 bg-border-strong" />
      <span>{children}</span>
    </p>
  );
}

/** Large editorial display heading, serif. */
export const displayClass = "text-balance font-serif font-normal leading-[0.98] tracking-[-0.02em]";
