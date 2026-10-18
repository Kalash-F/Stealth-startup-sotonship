import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Checker } from "@/components/app/checker/checker";
import { workspace } from "@/data/workspace";

export const metadata: Metadata = { title: "Check an invoice" };

export default function CheckerPage() {
  return (
    <div className="flex flex-col">
      <PageHeader
        title="Check an invoice"
        crumbs={[{ label: workspace.name, href: "/app" }, { label: "Check an invoice" }]}
        description="Upload a trade invoice or pick a test one. Every line is given its customs code and priced against what the goods normally trade for."
      />
      {/* The workspace main scrolls; the invoice column sticks inside it on wide screens. */}
      <div className="p-4 lg:p-6">
        {/* useSearchParams (shareable ?sample= links) needs a Suspense boundary */}
        <Suspense fallback={<div className="h-64 rounded-md border border-border bg-surface" aria-busy="true" />}>
          <Checker />
        </Suspense>
      </div>
    </div>
  );
}
