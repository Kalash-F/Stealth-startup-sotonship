import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { ActivityFeed } from "@/components/app/overview/activity-feed";
import { AttentionQueue } from "@/components/app/overview/attention-queue";
import { CorridorChart } from "@/components/app/overview/corridor-chart";
import { FeaturedCase } from "@/components/app/overview/featured-case";
import { FlagsByRuleChart } from "@/components/app/overview/flags-by-rule-chart";
import { KpiStrip } from "@/components/app/overview/kpi-strip";
import { ScreeningChart } from "@/components/app/overview/screening-chart";
import { SyntheticBadge } from "@/components/domain/synthetic-badge";
import { Button } from "@/components/ui/button";
import { analystById, demoUserId } from "@/data/reference";
import { DEMO_NOW, workspace } from "@/data/workspace";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage() {
  const me = analystById(demoUserId)!;
  return (
    <div>
      <PageHeader
        title="Overview"
        crumbs={[{ label: workspace.name, href: "/app" }, { label: "Overview" }]}
        description={`Good morning, ${me.name.split(" ")[0]}. What needs attention across the sample portfolio on ${formatDate(DEMO_NOW)}.`}
        meta={<SyntheticBadge />}
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/app/investigations">Open investigations</Link>
          </Button>
        }
      />
      <div className="grid gap-4 p-4 lg:p-6 [&>*]:min-w-0">
        <KpiStrip />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] [&>*]:min-w-0">
          <AttentionQueue />
          <FeaturedCase />
        </div>
        <div className="grid gap-4 lg:grid-cols-12 [&>*]:min-w-0">
          <ScreeningChart className="lg:col-span-7" />
          <ActivityFeed className="lg:col-span-5" />
        </div>
        <div className="grid gap-4 lg:grid-cols-12 [&>*]:min-w-0">
          <FlagsByRuleChart className="lg:col-span-7" />
          <CorridorChart className="lg:col-span-5" />
        </div>
      </div>
    </div>
  );
}
