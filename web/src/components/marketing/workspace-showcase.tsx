import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AttentionQueue } from "@/components/app/overview/attention-queue";
import { KpiStrip } from "@/components/app/overview/kpi-strip";
import { SummaryTab } from "@/components/app/case/summary-tab";
import { CaseStatusLabel, PriorityScore } from "@/components/domain/status";
import { investigationById } from "@/data/investigations";
import { workspace } from "@/data/workspace";
import { cn } from "@/lib/utils";
import { NetworkPreview } from "./network-preview";
import { Container, SectionIndex, displayClass } from "./primitives";
import { ShowcaseTabs } from "./showcase-tabs";

function CaseHeader() {
  const inv = investigationById("CASE-0142")!;
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
      <div className="min-w-0">
        <p className="font-mono text-xs text-fg-subtle">
          {inv.id} · {inv.route} · {inv.commodity}
        </p>
        <h3 className="mt-1 text-[20px] font-semibold tracking-tight">{inv.title}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <CaseStatusLabel status={inv.status} />
        </div>
      </div>
      <PriorityScore band={inv.priority_band} score={inv.priority_score} />
    </div>
  );
}

/** Workspace · what happens after the flag, shown with the workspace's own screens. */
export function WorkspaceShowcase() {
  const inv = investigationById("CASE-0142")!;
  const panels = [
    {
      id: "queue",
      label: "Review queue",
      blurb: "Highest priority first, with status, value and due date.",
      crumbs: [workspace.name, "Overview"],
      href: "/app",
      scaled: true,
      content: (
        <div className="grid gap-4 [&>*]:min-w-0">
          <KpiStrip />
          <AttentionQueue />
        </div>
      ),
    },
    {
      id: "case",
      label: "Case file",
      blurb: "Flags, evidence and the investigator’s assessment in one place.",
      crumbs: ["Investigations", inv.id, "Summary"],
      href: `/app/investigations/${inv.id}`,
      scaled: true,
      content: (
        <>
          <CaseHeader />
          <SummaryTab inv={inv} />
        </>
      ),
    },
    {
      id: "network",
      label: "Network",
      blurb: "Invoices, payments and owners on one map. Select any node.",
      crumbs: [workspace.name, "Entities"],
      href: "/app/entities",
      content: <NetworkPreview />,
    },
  ];

  return (
    <section id="workspace" aria-labelledby="workspace-heading" className="scroll-mt-16 border-t border-border py-20 md:py-28">
      <Container>
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <SectionIndex n="04">Workspace</SectionIndex>
            <h2 id="workspace-heading" className={cn(displayClass, "mt-5 text-[2.4rem] leading-[1.02] sm:text-6xl lg:text-[4.25rem]")}>
              Every flagged invoice becomes a case.
            </h2>
          </div>
          <p className="max-w-md text-[16px] leading-relaxed text-fg-muted lg:col-span-5">
            Cases are ranked by priority, not arrival. Open one to see its flags, documents, payments and the companies behind it, then
            record a decision your auditors can follow.
          </p>
        </div>
        <div className="mt-12 lg:mt-16">
          <ShowcaseTabs panels={panels} />
        </div>
        <p className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[14px] text-fg-muted">
          <span>The demo workspace runs on ten sample cases. Everything you see here is clickable there.</span>
          <Link href="/app" className="inline-flex items-center gap-1.5 font-medium text-fg underline-offset-4 hover:underline">
            Explore the workspace <ArrowRight aria-hidden className="size-4" />
          </Link>
        </p>
      </Container>
    </section>
  );
}
