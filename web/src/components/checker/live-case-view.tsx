"use client";

import Link from "next/link";
import { FolderX } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ReportView } from "@/components/checker/report-view";
import { Button } from "@/components/ui/button";
import { workspace } from "@/data/workspace";
import { getLiveReport, useLiveVersion } from "@/lib/live-cases";

/**
 * A case made by checking an invoice in this session. Live cases live in memory only,
 * so after a reload (or on a shared link) the report is gone and the page says so.
 */
export function LiveCaseView({ id }: { id: string }) {
  useLiveVersion();
  const live = getLiveReport(id);

  if (!live) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <FolderX className="size-8 text-fg-subtle" aria-hidden />
        <div>
          <h1 className="text-page font-semibold text-fg">Live check not available</h1>
          <p className="mt-1 max-w-md text-body text-fg-muted">
            {id} was checked in an earlier session. The demo keeps live checks in memory only, so they are gone after a reload.
          </p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href="/app/checker">Check an invoice</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        crumbs={[
          { label: workspace.name, href: "/app" },
          { label: "Investigations", href: "/app/investigations" },
          { label: id },
        ]}
        title={live.title}
        description="Checked live in the invoice checker. Not saved: a reload clears it."
      />
      <div className="p-4 lg:p-6">
        <ReportView report={live.report} />
      </div>
    </div>
  );
}
