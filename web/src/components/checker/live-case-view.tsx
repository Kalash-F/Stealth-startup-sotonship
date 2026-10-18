"use client";

import Link from "next/link";
import { FolderX } from "lucide-react";
import { CaseView } from "@/components/app/case/case-view";
import { Button } from "@/components/ui/button";
import { investigationById } from "@/data/investigations";
import { useCases, useLiveRestored } from "@/lib/live-cases";

/**
 * A case made by checking an invoice. It opens on the normal case page once this browser's
 * saved checks are restored; a link to a check made in another browser says it is not here.
 */
export function LiveCaseView({ id }: { id: string }) {
  const restored = useLiveRestored();
  const inv = investigationById(id, useCases());

  if (inv) return <CaseView key={`${inv.id}-${inv.updated}`} id={id} />;

  if (!restored) {
    return (
      <div className="grid gap-4 p-4 lg:p-6" aria-busy="true" aria-label="Loading case">
        <div className="h-6 w-48 rounded-sm bg-surface-2" />
        <div className="h-8 w-2/3 rounded-sm bg-surface-2" />
        <div className="h-40 rounded-md border border-border bg-surface" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <FolderX className="size-8 text-fg-subtle" aria-hidden />
      <div>
        <h1 className="text-page font-semibold text-fg">Case not found</h1>
        <p className="mt-1 max-w-md text-body text-fg-muted">
          {id} is not in this browser. Cases made by checking an invoice are kept in the browser that checked it.
        </p>
      </div>
      <Button asChild variant="secondary" size="sm">
        <Link href="/app/checker">Check an invoice</Link>
      </Button>
    </div>
  );
}
