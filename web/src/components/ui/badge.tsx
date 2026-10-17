import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Square-cornered tags. Colour is never the only signal: every badge carries text. */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-xs border px-1.5 py-0.5 text-[11.5px] font-medium leading-4",
  {
    variants: {
      tone: {
        neutral: "border-border bg-surface-2 text-fg-muted",
        accent: "border-accent/40 bg-accent-soft text-accent",
        low: "border-risk-low/40 bg-risk-low-soft text-risk-low",
        review: "border-risk-review/40 bg-risk-review-soft text-risk-review",
        high: "border-risk-high/40 bg-risk-high-soft text-risk-high",
        finding: "border-finding/50 bg-finding-soft text-finding",
        info: "border-info/40 bg-info-soft text-info",
        outline: "border-border-strong bg-transparent text-fg-muted",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
