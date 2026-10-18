"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Building2, FileText, FolderSearch, Search } from "lucide-react";
import { entities } from "@/data/reference";
import { investigations } from "@/data/investigations";
import { cn } from "@/lib/utils";

type Result = { id: string; href: string; kind: "Case" | "Entity" | "Invoice"; title: string; meta: string };

const index: Result[] = [
  ...investigations.map((i) => ({ id: i.id, href: `/app/investigations/${i.id}`, kind: "Case" as const, title: i.title, meta: i.id })),
  ...investigations.map((i) => ({
    id: `inv-${i.invoice.invoice_id}`,
    href: `/app/investigations/${i.id}`,
    kind: "Invoice" as const,
    title: i.invoice.invoice_id,
    meta: `${i.invoice.seller.name} → ${i.invoice.buyer.name}`,
  })),
  ...entities.map((e) => ({ id: e.id, href: `/app/entities?entity=${e.id}`, kind: "Entity" as const, title: e.name, meta: `${e.kind} · ${e.city}` })),
];

const icon = { Case: FolderSearch, Entity: Building2, Invoice: FileText };

/** ⌘K search across cases, invoices and entities in the sample workspace. */
export function QuickSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState(0);

  const results = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return index.filter((r) => r.kind === "Case").slice(0, 6);
    return index.filter((r) => `${r.title} ${r.meta}`.toLowerCase().includes(term)).slice(0, 8);
  }, [q]);

  React.useEffect(() => setActive(0), [q]);
  React.useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const go = (r: Result) => {
    onOpenChange(false);
    router.push(r.href);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content className="theme-ink fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-md border border-border bg-surface text-fg shadow-frame">
          <DialogPrimitive.Title className="sr-only">Search the workspace</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Search cases, invoices and entities. Use arrow keys to move and Enter to open.</DialogPrimitive.Description>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-4 text-fg-subtle" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, results.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter" && results[active]) {
                  go(results[active]);
                }
              }}
              placeholder="Try “Orchard Gate”, “CASE-0142” or “copper”"
              aria-label="Search the workspace"
              className="h-12 flex-1 bg-transparent text-body text-fg outline-none placeholder:text-fg-subtle"
            />
            <kbd className="rounded-xs border border-border px-1 font-mono text-[10px] text-fg-subtle">Esc</kbd>
          </div>
          <ul className="max-h-80 overflow-y-auto p-1" role="listbox" aria-label="Results">
            {results.length === 0 ? (
              <li className="px-3 py-6 text-center text-body text-fg-muted">No matches in the sample workspace.</li>
            ) : (
              results.map((r, i) => {
                const Icon = icon[r.kind];
                return (
                  <li key={r.id} role="option" aria-selected={i === active}>
                    <button
                      onClick={() => go(r)}
                      onMouseEnter={() => setActive(i)}
                      className={cn("flex w-full items-center gap-3 rounded-sm px-2.5 py-2 text-left", i === active && "bg-surface-2")}
                    >
                      <Icon className="size-4 shrink-0 text-fg-subtle" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body text-fg">{r.title}</span>
                        <span className="block truncate text-meta text-fg-subtle">{r.meta}</span>
                      </span>
                      <span className="font-mono text-meta uppercase text-fg-subtle">{r.kind}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
