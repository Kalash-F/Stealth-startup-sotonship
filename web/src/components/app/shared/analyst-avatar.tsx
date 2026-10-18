import { analystById } from "@/data/reference";
import { cn } from "@/lib/utils";

/** Initials in a round chip (avatars are the only fully rounded element). */
export function AnalystAvatar({ id, className, withName = false }: { id: string; className?: string; withName?: boolean }) {
  const a = analystById(id);
  const initials = a?.initials ?? "—";
  const name = a?.name ?? "Unassigned";
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-surface-3 font-mono text-[10px] font-medium text-fg"
        title={withName ? undefined : name}
        aria-hidden={withName}
      >
        {initials}
      </span>
      {withName ? <span className="truncate text-body text-fg">{name}</span> : <span className="sr-only">{name}</span>}
    </span>
  );
}
