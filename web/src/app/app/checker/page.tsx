import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { Checker } from "@/components/app/checker/checker";
import { workspace } from "@/data/workspace";

export const metadata: Metadata = { title: "Check an invoice" };

export default function CheckerPage() {
  return (
    <div>
      <PageHeader
        title="Check an invoice"
        crumbs={[{ label: workspace.name, href: "/app" }, { label: "Check an invoice" }]}
        description="Classify every line, compare its price with trade data and run the red-flag rules. Live, against the backend."
      />
      <div className="p-4 lg:p-6">
        <Checker />
      </div>
    </div>
  );
}
