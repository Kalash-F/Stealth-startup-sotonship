import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { HeaderCounts } from "@/components/app/overview/header-counts";
import { InvestigationList } from "@/components/app/investigations/investigation-list";
import { ListDescription } from "@/components/app/investigations/list-description";
import { SyntheticBadge } from "@/components/domain/synthetic-badge";
import { workspace } from "@/data/workspace";

export const metadata: Metadata = { title: "Investigations" };

function ListFallback() {
  return (
    <div className="grid gap-3" aria-busy="true" aria-label="Loading investigations">
      <div className="h-[60px] rounded-md border border-border bg-surface" />
      <div className="h-[480px] rounded-md border border-border bg-surface" />
    </div>
  );
}

export default function InvestigationsPage() {
  return (
    <div className="flex flex-col lg:min-h-0 lg:flex-1">
      <PageHeader
        title="Investigations"
        crumbs={[{ label: workspace.name, href: "/app" }, { label: "Investigations" }]}
        description={<ListDescription />}
        meta={<SyntheticBadge />}
        actions={<HeaderCounts />}
      />
      <div className="flex flex-col p-4 lg:min-h-0 lg:flex-1 lg:p-6">
        <Suspense fallback={<ListFallback />}>
          <InvestigationList />
        </Suspense>
      </div>
    </div>
  );
}
