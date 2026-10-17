import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CaseStatusLabel, PriorityBadge, PriorityScore } from "@/components/domain/status";
import { FlagItem } from "@/components/domain/flag-list";
import { PriceBandBar } from "@/components/domain/price-band-bar";
import { benchmarks, entityById } from "@/data/reference";
import { investigationById, transactionsForCase } from "@/data";
import { formatMoney, formatDateShort } from "@/lib/format";
import { Container, ProductFrame } from "./primitives";

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative border-b border-border">
      <Container className="grid gap-14 pb-16 pt-10 md:pb-24 md:pt-16 lg:grid-cols-12 lg:gap-8 lg:pb-24 lg:pt-16">
        <div className="lg:col-span-5 lg:pt-6">
          <p className="eyebrow">Trade-based money laundering investigation</p>
          <h1
            id="hero-title"
            className="mt-5 text-balance font-serif text-[2.9rem] font-normal leading-[0.98] tracking-[-0.02em] sm:text-6xl lg:text-[4.5rem]"
          >
            See the financial crime hidden inside global trade
          </h1>
          <p className="mt-6 max-w-md text-[17px] leading-relaxed text-fg-muted">
            Connect trade documents, shipments, counterparties and payments in one workspace, so investigators can surface suspicious
            activity and explain exactly why it was raised.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" variant="primary">
              <Link href="/request-demo">Request a demo</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/app">
                Explore the platform <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </div>

        <div className="lg:col-span-7 lg:col-start-6 lg:-mr-6 xl:-mr-12">
          <HeroVisual />
          <p className="mt-3 font-mono text-2xs uppercase tracking-[0.06em] text-fg-subtle">Fictional sample case · illustrative comparison range</p>
        </div>
      </Container>
    </section>
  );
}

function HeroVisual() {
  const inv = investigationById("CASE-0142")!;
  const l1 = inv.invoice.line_items[0];
  const bench = benchmarks[inv.hs6];
  const flags = [inv.flags[0], inv.flags[1], inv.flags[2]];
  const payments = transactionsForCase(inv.id).filter((t) => t.fromEntityId === "ent-orchard");
  return (
    <ProductFrame
      label="Product preview of case CASE-0142, fictional sample data"
      crumbs={["Investigations", inv.id]}
      bodyClassName="grid gap-0 md:grid-cols-[1.35fr_1fr]"
    >
      <div className="min-w-0 space-y-5 p-5 md:border-r md:border-border">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-xs text-fg-subtle">
              {inv.id} · {inv.invoice.invoice_id}
            </p>
            <h2 className="mt-1 text-[17px] font-semibold leading-snug tracking-tight">{inv.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <PriorityBadge band={inv.priority_band} />
              <CaseStatusLabel status={inv.status} />
            </div>
          </div>
          <div className="shrink-0 whitespace-nowrap"><PriorityScore band={inv.priority_band} score={inv.priority_score} /></div>
        </div>

        <div className="border border-border bg-surface p-4">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <p className="text-[13px] font-semibold">Line L1 · {l1.description.split(",")[0]}</p>
            <p className="font-mono text-2xs text-fg-subtle">{formatMoney(l1.line_total)}</p>
          </div>
          <PriceBandBar benchmark={bench} stated={l1.unit_price} />
        </div>

        <ul className="divide-y divide-border">
          {flags.map((f) => (
            <li key={f.flag_id} className="py-3 first:pt-0 last:pb-0">
              <FlagItem flag={f} compact />
            </li>
          ))}
        </ul>
      </div>

      <div className="min-w-0 space-y-5 p-5">
        <div>
          <h3 className="eyebrow">Linked parties</h3>
          <ul className="mt-3 space-y-3 text-[13px]">
            {["ent-orchard", "ent-calder", "ent-yongjia", "ent-vltava"].map((id) => {
              const e = entityById(id)!;
              return (
                <li key={id}>
                  <p className="font-medium text-fg">{e.name}</p>
                  <p className="text-xs text-fg-subtle">
                    {e.kind === "intermediary" ? "Intermediary" : e.kind === "importer" ? "Importer" : e.kind === "manufacturer" ? "Manufacturer" : "Related party"} · {e.city}
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 border-l-2 border-risk-high pl-3 text-xs leading-relaxed text-fg-muted">
            Orchard Gate and Vltava Componenta share a beneficial owner, D. Ferrant.
          </p>
        </div>
        <div>
          <h3 className="eyebrow">Payments out of Orchard Gate</h3>
          <ul className="mt-3 divide-y divide-border font-mono text-xs tabular">
            {payments.map((t) => (
              <li key={t.id} className="flex items-baseline justify-between gap-3 py-2 first:pt-0">
                <span className="min-w-0 text-fg-subtle">
                  {formatDateShort(t.at)} → {entityById(t.toEntityId)!.name.split(" ")[0]}
                </span>
                <span className="shrink-0 text-fg">{formatMoney(t.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="border border-border bg-surface p-3">
          <h3 className="eyebrow">Next action</h3>
          <p className="mt-2 text-[13px] leading-snug">{inv.nextAction.label}</p>
          <p className="mt-2 font-mono text-2xs text-risk-review">Due 21 Oct 2026</p>
        </div>
      </div>
    </ProductFrame>
  );
}
