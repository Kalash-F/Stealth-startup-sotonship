import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { investigationById } from "@/data";
import { formatMoney } from "@/lib/format";
import { TradeMap } from "./map/trade-map";

/**
 * Section A · The hidden pattern.
 * The corridor map fills the upper part of the viewport; the headline sits
 * low on the left, over the southern ocean, where nothing else is drawn.
 */
export function Hero() {
  const inv = investigationById("CASE-0142")!;
  return (
    <section
      aria-labelledby="hero-title"
      className="theme-night relative isolate flex flex-col overflow-hidden bg-bg text-fg xl:h-[clamp(780px,calc(100svh-64px),1060px)]"
    >
      <div className="order-2 mx-auto w-full max-w-[1680px] pb-10 xl:order-1 xl:min-h-0 xl:flex-1 xl:px-10 xl:pb-0 xl:pt-8">
        <TradeMap />
      </div>

      <div className="order-1 mx-auto w-full max-w-[1440px] px-4 pb-10 pt-12 sm:px-6 xl:order-2 xl:px-10 xl:pb-14 xl:pt-6">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <p className="eyebrow flex items-center gap-3 !text-fg-muted">
              <span aria-hidden className="inline-block h-px w-8 bg-accent" />
              Trade-based money laundering investigation
            </p>
            <h1
              id="hero-title"
              className="mt-5 text-balance font-serif text-[2.8rem] font-normal leading-[0.92] tracking-[-0.025em] sm:text-7xl lg:text-[5.5rem] xl:text-[min(6vw,6rem)]"
            >
              The goods went one way.
              <br />
              <em className="text-fg-muted">The money went another.</em>
            </h1>
          </div>
          <div className="lg:col-span-4">
            <p className="max-w-md text-[16px] leading-relaxed text-fg-muted xl:text-[15.5px]">
              Invoices, shipments, counterparties and payments look ordinary one at a time. Lading draws them on one canvas, so
              investigators can see where trade and money part ways and explain why it matters.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild size="lg" variant="accent">
                <Link href="/request-demo">Request a demo</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/app">
                  Explore the platform <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
            <p className="mt-6 font-mono text-[10.5px] uppercase leading-relaxed tracking-[0.08em] text-fg-subtle">
              Sample case {inv.id} · {formatMoney(inv.invoice.stated_total)} invoiced · fictional data, stylised routes
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
