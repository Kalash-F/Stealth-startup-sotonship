import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { AttentionQueue } from "@/components/app/overview/attention-queue";
import { FeaturedCase } from "@/components/app/overview/featured-case";
import { HeaderCounts } from "@/components/app/overview/header-counts";
import { workspace } from "@/data/workspace";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage() {
  return (
    <div className="flex flex-col lg:min-h-0 lg:flex-1">
      <PageHeader title="Overview" crumbs={[{ label: workspace.name, href: "/app" }, { label: "Overview" }]} actions={<HeaderCounts />} />
      <div className="flex flex-col p-4 lg:min-h-0 lg:flex-1 lg:p-6 [&>*]:min-w-0">
        <AttentionQueue className="lg:min-h-0" clearFloatingCard />
      </div>
      <FeaturedCase />
    </div>
  );
}
