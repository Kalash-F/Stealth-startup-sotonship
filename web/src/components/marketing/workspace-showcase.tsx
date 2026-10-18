import { AttentionQueue } from "@/components/app/overview/attention-queue";
import { FlagsByRuleChart } from "@/components/app/overview/flags-by-rule-chart";
import { KpiStrip } from "@/components/app/overview/kpi-strip";
import { ScreeningChart } from "@/components/app/overview/screening-chart";
import { InvoiceTab } from "@/components/app/case/invoice-tab";
import { SummaryTab } from "@/components/app/case/summary-tab";
import { TransactionsTab } from "@/components/app/case/transactions-tab";
import { CaseStatusLabel, PriorityScore } from "@/components/domain/status";
import { investigationById } from "@/data/investigations";
import { workspace } from "@/data/workspace";
import { Container, SectionIndex, displayClass } from "./primitives";
import { ShowcaseTabs } from "./showcase-tabs";
import { cn } from "@/lib/utils";

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

/** Section D · The investigation workspace, shown with the real components. */
export function WorkspaceShowcase() {
  const inv = investigationById("CASE-0142")!;
  const panels = [
    {
      id: "overview",
      label: "Overview",
      blurb: "The queue, ranked by review priority rather than arrival.",
      crumbs: [workspace.name, "Overview"],
      href: "/app",
      content: (
        <div className="grid gap-4 [&>*]:min-w-0">
          <KpiStrip />
          <div className="grid gap-4 lg:grid-cols-12 [&>*]:min-w-0">
            <AttentionQueue className="lg:col-span-7" />
            <div className="grid gap-4 lg:col-span-5">
              <ScreeningChart />
              <FlagsByRuleChart />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "case",
      label: "Case file",
      blurb: "Why it was flagged, and how firmly each point is established.",
      crumbs: ["Investigations", inv.id, "Summary"],
      href: `/app/investigations/${inv.id}`,
      content: (
        <>
          <CaseHeader />
          <SummaryTab inv={inv} />
        </>
      ),
    },
    {
      id: "invoice",
      label: "Invoice evidence",
      blurb: "Every line against its comparison range, with the numbers shown.",
      crumbs: ["Investigations", inv.id, "Invoice"],
      href: `/app/investigations/${inv.id}`,
      content: (
        <>
          <CaseHeader />
          <InvoiceTab inv={inv} />
        </>
      ),
    },
    {
      id: "payments",
      label: "Payments",
      blurb: "Where the money went after the invoice was paid.",
      crumbs: ["Investigations", inv.id, "Transactions"],
      href: `/app/investigations/${inv.id}`,
      content: (
        <>
          <CaseHeader />
          <TransactionsTab inv={inv} />
        </>
      ),
    },
  ];

  return (
    <section id="workspace" aria-labelledby="workspace-heading" className="theme-ink scroll-mt-16 overflow-hidden bg-bg py-20 text-fg md:py-28 lg:py-36">
      <Container>
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <SectionIndex n="03">The investigation workspace</SectionIndex>
            <h2 id="workspace-heading" className={cn(displayClass, "mt-6 text-[2.6rem] sm:text-6xl lg:text-[5rem]")}>
              The whole case,
              <br />
              <em className="text-fg-muted">open on one desk.</em>
            </h2>
          </div>
          <p className="max-w-sm text-[16px] leading-relaxed text-fg-muted lg:col-span-4">
            These are the workspace&rsquo;s own screens, running on the sample data. Switch views to see what an investigator works
            from, then open any of them in the demo.
          </p>
        </div>
        <div className="mt-14 lg:mt-20">
          <ShowcaseTabs panels={panels} />
        </div>
      </Container>
    </section>
  );
}
