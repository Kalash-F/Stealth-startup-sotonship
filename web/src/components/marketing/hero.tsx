import Link from "next/link";
import { Button } from "@/components/ui/button";
import { brand } from "@/lib/brand";
import { TradeMap } from "./map/trade-map";

/**
 * The outcome first, in words a buyer can repeat: what it does, on what data, and what you get.
 * The corridor map sits below the copy (never under it), and right after the buttons on a phone.
 */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="theme-night relative isolate flex flex-col overflow-hidden bg-bg text-fg xl:h-[clamp(760px,calc(100svh-64px),980px)]"
    >
      <div className="mx-auto w-full max-w-[1440px] px-4 pb-8 pt-10 sm:px-6 sm:pt-14 xl:px-10 xl:pb-8 xl:pt-12">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
          <div className="lg:col-span-7">
            <p className="flex items-center gap-3 text-[13px] font-medium text-fg-muted">
              <span aria-hidden className="inline-block h-px w-8 bg-accent" />
              {brand.descriptor}
            </p>
            <h1
              id="hero-title"
              className="mt-4 text-balance font-serif text-[2.6rem] font-normal leading-[0.95] tracking-[-0.025em] sm:text-6xl lg:text-[4.25rem] xl:text-[4.75rem]"
            >
              Spot mispriced trade invoices in seconds.
            </h1>
          </div>
          <div className="lg:col-span-5">
            <p className="max-w-md text-[16px] leading-relaxed text-fg-muted sm:text-[17px]">
              Upload an invoice. {brand.name} prices every line against three years of HMRC import data and tells you which lines need
              review, and why.
            </p>
            <div id="hero-actions" className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="accent" className="px-4 text-[14px] sm:px-5 sm:text-[15px]">
                <Link href="/app/checker">Check an invoice</Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="px-4 text-[14px] sm:px-5 sm:text-[15px]">
                <Link href="/app">Explore the workspace</Link>
              </Button>
            </div>
            <p className="mt-3 text-[13px] text-fg-subtle">No sign-up. Try a test invoice or upload your own PDF.</p>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1440px] pb-12 xl:min-h-0 xl:flex-1 xl:px-10 xl:pb-10">
        <TradeMap />
      </div>
    </section>
  );
}
