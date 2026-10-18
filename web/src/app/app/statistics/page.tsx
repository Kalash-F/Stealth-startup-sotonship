import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { CorridorChart } from "@/components/app/overview/corridor-chart";
import { FlagsByRuleChart } from "@/components/app/overview/flags-by-rule-chart";
import { ScreeningChart } from "@/components/app/overview/screening-chart";
import { SyntheticBadge } from "@/components/domain/synthetic-badge";
import { workspace } from "@/data/workspace";

/** Each chart fills its column's height on wide screens and scrolls inside itself if it runs out. */
const fill = "xl:min-h-0 xl:overflow-y-auto";

export default function StatisticsPage() {
  return (
    <div className="flex flex-col xl:min-h-0 xl:flex-1">
      <PageHeader
        title="Statistics"
        crumbs={[{ label: workspace.name, href: "/app" }, { label: "Statistics" }]}
        description="Screening volume, which rules raise flags, and where the value under review sits."
        meta={<SyntheticBadge />}
      />
      <div className="grid gap-4 p-4 lg:p-6 xl:min-h-0 xl:flex-1 xl:grid-cols-3 xl:grid-rows-[minmax(0,1fr)] [&>*]:min-w-0">
        <ScreeningChart className={fill} />
        <FlagsByRuleChart className={fill} />
        <CorridorChart className={fill} />
      </div>
    </div>
  );
}

export const metadata: Metadata = { title: "Statistics" };
