import { PageHeader } from "@/components/app/page-header";
import { EntityGraph } from "@/components/domain/entity-graph";
import { PriceBandBar } from "@/components/domain/price-band-bar";
import { FlagList } from "@/components/domain/flag-list";
import { Panel, PanelHeader, PanelBody } from "@/components/ui/panel";
import { benchmarks, graphEdges, graphNodes, investigationById } from "@/data";

// Foundation smoke page; replaced by the overview dashboard.
export default function OverviewPage() {
  const c = investigationById("CASE-0142")!;
  return (
    <div>
      <PageHeader title="Overview" crumbs={[{ label: "Workspace", href: "/app" }, { label: "Overview" }]} />
      <div className="grid gap-4 p-6">
        <Panel>
          <PanelHeader title="Price" />
          <PanelBody>
            <PriceBandBar benchmark={benchmarks["731815"]} stated={2.85} />
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader title="Flags" />
          <PanelBody>
            <FlagList flags={c.flags} />
          </PanelBody>
        </Panel>
        <Panel className="h-[640px]">
          <EntityGraph nodes={graphNodes} edges={graphEdges} />
        </Panel>
      </div>
    </div>
  );
}
