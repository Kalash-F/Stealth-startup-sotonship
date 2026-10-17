import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { InvestigationList } from "@/components/app/investigations/investigation-list";
import { SyntheticBadge } from "@/components/domain/synthetic-badge";
import { caseCounts, workspace } from "@/data/workspace";

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
  const c = caseCounts();
  return (
    <div>
      <PageHeader
        title="Investigations"
        crumbs={[{ label: workspace.name, href: "/app" }, { label: "Investigations" }]}
        description={`${c.open} open cases, ${c.reviewNow} at review-now priority. Priority is the sum of the flags behind each case; open a case to see the evidence.`}
        meta={<SyntheticBadge />}
      />
      <div className="p-4 lg:p-6">
        <Suspense fallback={<ListFallback />}>
          <InvestigationList />
        </Suspense>
      </div>
    </div>
  );
}
