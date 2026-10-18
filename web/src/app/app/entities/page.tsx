import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { EntityExplorer } from "@/components/app/entities/entity-explorer";
import { SyntheticBadge } from "@/components/domain/synthetic-badge";
import { workspace } from "@/data/workspace";

export const metadata: Metadata = { title: "Entities" };

export default function EntitiesPage() {
  return (
    <div className="flex flex-col xl:min-h-0 xl:flex-1">
      <PageHeader
        title="Entities"
        crumbs={[{ label: workspace.name, href: "/app" }, { label: "Entities" }]}
        description="Companies, owners, documents and payments connected across cases. Follow the money from one record to the next."
        meta={<SyntheticBadge />}
      />
      <div className="flex flex-col p-4 lg:p-6 xl:min-h-0 xl:flex-1">
        <Suspense
          fallback={<div className="h-[720px] rounded-md border border-border bg-surface" aria-busy="true" aria-label="Loading network" />}
        >
          <EntityExplorer />
        </Suspense>
      </div>
    </div>
  );
}
