import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { TransactionsTab } from "@/components/app/case/transactions-tab";
import { AttentionQueue } from "@/components/app/overview/attention-queue";
import { KpiStrip } from "@/components/app/overview/kpi-strip";
import { FlagList } from "@/components/domain/flag-list";
import { CaseStatusLabel, PriorityBadge, PriorityScore } from "@/components/domain/status";
import { Button } from "@/components/ui/button";
import { investigationById } from "@/data/investigations";
import { workspace } from "@/data/workspace";
import { cn } from "@/lib/utils";
import { Container, SectionIndex, displayClass } from "./primitives";

/**
 * A product window that works as one big link into the matching demo screen.
 * The link is stretched over the window; the contents underneath are inert.
 */
function Window({ href, crumbs, title, className, bodyClassName, children }: { href: string; crumbs: string; title: string; className?: string; bodyClassName?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "theme-ink group relative overflow-hidden rounded-lg border border-border-strong bg-bg text-fg shadow-frame transition-transform duration-300 hover:-translate-y-1 focus-within:-translate-y-1",
        className,
      )}
    >
      <div className="flex h-9 items-center justify-between gap-3 border-b border-border bg-surface px-3.5">
        <span className="truncate font-mono text-[11px] text-fg-subtle">{crumbs}</span>
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1 text-[11.5px] text-fg-muted transition-colors after:absolute after:inset-0 after:z-10 group-hover:text-fg"
        >
          {title} <ArrowUpRight aria-hidden className="size-3.5" />
        </Link>
      </div>
      <div inert className={cn("relative overflow-hidden", bodyClassName)}>
        {children}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-bg to-transparent" />
      </div>
    </div>
  );
}

/** Section G · Enter the platform. */
export function EnterPlatform() {
  const inv = investigationById("CASE-0142")!;
  return (
    <section aria-labelledby="enter-heading" className="theme-night relative overflow-hidden bg-bg pt-20 text-fg md:pt-28 lg:pt-36">
      <Container>
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <SectionIndex n="06">Enter the platform</SectionIndex>
            <h2 id="enter-heading" className={cn(displayClass, "mt-6 text-[3rem] sm:text-7xl lg:text-[6.5rem]")}>
              Open the case file.
            </h2>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-fg-muted">
              The demo workspace holds ten fictional cases, the Orchard Gate network and every screen shown on this page. No sign-up,
              nothing to install.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:col-span-4 lg:flex-col lg:items-stretch xl:flex-row xl:items-center xl:justify-end">
            <Button asChild size="lg" variant="accent">
              <Link href="/app">
                Explore the platform <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/request-demo">Request a demo</Link>
            </Button>
          </div>
        </div>
      </Container>

      <div className="mx-auto mt-16 max-w-[1600px] px-4 sm:px-6 lg:mt-24 lg:px-10">
        <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
          <Window href="/app" crumbs={`${workspace.name} / Overview`} title="Overview" className="lg:col-span-7" bodyClassName="h-[420px] lg:h-[612px]">
            <div className="grid gap-4 p-4 md:p-5">
              <KpiStrip />
              <AttentionQueue />
            </div>
          </Window>
          <div className="grid gap-5 lg:col-span-5">
            <Window href={`/app/investigations/${inv.id}`} crumbs={`Investigations / ${inv.id}`} title={`Open ${inv.id}`} bodyClassName="h-[290px]">
              <div className="p-4 md:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-fg-subtle">{inv.route}</p>
                    <p className="mt-1 text-[16px] font-semibold leading-snug tracking-tight">{inv.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <PriorityBadge band={inv.priority_band} />
                      <CaseStatusLabel status={inv.status} />
                    </div>
                  </div>
                  <PriorityScore band={inv.priority_band} score={inv.priority_score} />
                </div>
                <FlagList flags={inv.flags.slice(0, 2)} className="mt-4" />
              </div>
            </Window>
            <Window href={`/app/investigations/${inv.id}`} crumbs={`Investigations / ${inv.id} / Transactions`} title="Follow the payments" bodyClassName="h-[250px]">
              <div className="w-[133%] origin-top-left scale-75 p-5">
                <TransactionsTab inv={inv} />
              </div>
            </Window>
          </div>
        </div>
      </div>
      <div aria-hidden className="h-20 lg:h-28" />
    </section>
  );
}
