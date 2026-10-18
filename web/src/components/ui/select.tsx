import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Native select styled to match Input. Native keeps keyboard and screen-reader behaviour for free. */
export const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <span className={cn("relative inline-flex", className)}>
      <select
        ref={ref}
        className={cn(
          "h-9 w-full appearance-none rounded-sm border border-control bg-surface pl-3 pr-8 text-body text-fg",
          "focus-visible:border-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/25",
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" aria-hidden />
    </span>
  ),
);
NativeSelect.displayName = "NativeSelect";
