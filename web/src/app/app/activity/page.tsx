import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { ActivityFeed } from "@/components/app/overview/activity-feed";
import { SyntheticBadge } from "@/components/domain/synthetic-badge";
import { workspace } from "@/data/workspace";

export const metadata: Metadata = { title: "Recent activity" };

export default function ActivityPage() {
  return (
    <div className="flex flex-col lg:min-h-0 lg:flex-1">
      <PageHeader
        title="Recent activity"
        crumbs={[{ label: workspace.name, href: "/app" }, { label: "Recent activity" }]}
        description="Latest evidence and case events across the workspace, newest first."
        meta={<SyntheticBadge />}
      />
      <div className="flex flex-col p-4 lg:min-h-0 lg:flex-1 lg:p-6">
        <ActivityFeed limit={25} withHeader={false} className="lg:min-h-0" />
      </div>
    </div>
  );
}
