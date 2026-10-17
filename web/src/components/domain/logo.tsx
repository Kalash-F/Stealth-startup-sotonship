import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * Wordmark: a bill-of-lading style mark (two offset rules joined by a node)
 * set beside the name. Inherits currentColor; the node takes the accent.
 */
export function Logo({ className, showName = true }: { className?: string; showName?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
        <path d="M3 6.5h11" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
        <path d="M10 17.5h11" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
        <path d="M14 6.5 10 17.5" stroke="currentColor" strokeWidth="1.25" />
        <circle cx="14" cy="6.5" r="2.4" fill="var(--accent)" />
      </svg>
      {showName ? <span className="text-[15px] font-semibold tracking-[-0.02em]">{brand.name}</span> : null}
    </span>
  );
}
