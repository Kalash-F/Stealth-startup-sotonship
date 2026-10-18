import { ExternalLink } from "lucide-react";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { Container, SectionIndex, displayClass } from "./primitives";

/** From the benchmark databases' build_info (data/databases): records used, CN8 codes, months covered. */
const coverage = [
  { value: "16.1M", label: "HMRC import records" },
  { value: "9,471", label: "commodity codes priced" },
  { value: "38", label: "months of data, July 2023 to August 2026" },
  { value: "99", label: "price percentiles for each code, year and origin" },
];

/** From `make eval` (reports/eval/summary.md and the README results). */
const results = [
  { value: "17 of 18", label: "invoices with planted problems flagged for review" },
  { value: "0 of 42", label: "clean or unusual-but-legitimate invoices flagged" },
  { value: "95–100%", label: "of goods descriptions matched to the right HS code by the AI classifier, and never confidently wrong" },
];

/** Share of problem invoices found when reviewing the top N% of the queue, against random spot-checks of the same size. */
const budgets = [
  { budget: 10, ours: 33, random: 10 },
  { budget: 20, ours: 67, random: 20 },
  { budget: 30, ours: 94, random: 30 },
];

// Emphasis form: one hue for our ranking, the de-emphasis grey for the baseline (validated on the night surface).
const OURS = "#26a593";
const RANDOM = "#6f6c66";

function BudgetChart() {
  return (
    <figure>
      <figcaption className="text-[15px] font-medium">Problem invoices found, by how much of the queue you review</figcaption>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-fg-muted" aria-hidden>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-4 rounded-[2px]" style={{ background: OURS }} /> {brand.name}’s priority order
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-4 rounded-[2px]" style={{ background: RANDOM }} /> Random spot-checks
        </span>
      </div>
      <div className="group/chart mt-5 grid gap-5" aria-hidden>
        {budgets.map((b) => (
          <div
            key={b.budget}
            className="grid grid-cols-[4.5rem_1fr] items-center gap-x-4 transition-opacity group-hover/chart:opacity-40 hover:opacity-100"
          >
            <span className="font-mono text-[12px] text-fg-muted">Top {b.budget}%</span>
            <div className="grid gap-[2px]">
              {[
                [b.ours, OURS],
                [b.random, RANDOM],
              ].map(([v, color]) => (
                <div key={color} className="flex items-center gap-2">
                  <span className="h-3.5 rounded-r-[4px]" style={{ width: `${(Number(v) / 100) * 85}%`, background: color as string }} />
                  <span className="font-mono text-[12px] tabular text-fg">{v}%</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* sr-only on the wrapper: a table ignores the 1px width and would widen the page */}
      <div className="sr-only">
        <table>
          <caption>Share of problem invoices found when reviewing part of the queue</caption>
          <thead>
            <tr>
              <th scope="col">Queue reviewed</th>
              <th scope="col">{brand.name}’s priority order</th>
              <th scope="col">Random spot-checks</th>
            </tr>
          </thead>
          <tbody>
            {budgets.map((b) => (
              <tr key={b.budget}>
                <th scope="row">Top {b.budget}%</th>
                <td>{b.ours}%</td>
                <td>{b.random}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/** Data · the real price source and the measured results, stated once with their one caveat. */
export function DataProof() {
  return (
    <section id="data" aria-labelledby="data-heading" className="scroll-mt-16 border-t border-border py-20 md:py-28">
      <Container>
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <SectionIndex n="03">Data</SectionIndex>
            <h2 id="data-heading" className={cn(displayClass, "mt-5 text-[2.4rem] leading-[1.02] sm:text-6xl lg:text-[4.25rem]")}>
              Priced against what UK importers actually paid.
            </h2>
          </div>
          <p className="max-w-md text-[16px] leading-relaxed text-fg-muted lg:col-span-5">
            Price ranges come from HMRC’s Overseas Trade Statistics: every UK import of every commodity code, with the full spread of
            prices, not a single average.
          </p>
        </div>

        <dl className="mt-12 grid grid-cols-2 border-t border-border-strong lg:mt-16 lg:grid-cols-4">
          {coverage.map((c, i) => (
            <div
              key={c.label}
              className={cn(
                "border-b border-border py-6 pr-4 lg:border-b-0 lg:py-8",
                i % 2 === 1 && "border-l pl-4 lg:pl-6",
                i > 0 && "lg:border-l lg:pl-6",
              )}
            >
              <dt className="sr-only">{c.label}</dt>
              <dd className="font-serif text-[2.6rem] leading-none tracking-[-0.02em] sm:text-[3.4rem]">{c.value}</dd>
              <dd className="mt-3 text-[14px] leading-snug text-fg-muted">{c.label}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-14 grid gap-12 lg:mt-20 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <h3 className="text-[22px] font-medium tracking-tight">Tested on 60 invoices</h3>
            <dl className="mt-6 grid gap-6">
              {results.map((r) => (
                <div key={r.label} className="grid grid-cols-[7.5rem_1fr] items-baseline gap-4 border-t border-border pt-4">
                  <dt className="sr-only">{r.label}</dt>
                  <dd className="font-mono text-[22px] tabular tracking-tight text-accent">{r.value}</dd>
                  <dd className="text-[14px] leading-snug text-fg-muted">{r.label}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="lg:col-span-7">
            <BudgetChart />
            <p className="mt-6 text-[14px] leading-relaxed text-fg-muted">
              Reviewing the top 30% of the queue finds 94% of the problem invoices, against 30% for random spot-checks of the same size.
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-[13px] leading-relaxed text-fg-subtle md:flex-row md:justify-between md:gap-12">
          <p className="max-w-2xl">
            The test invoices are synthetic, with problems planted by our own generator, so these results show the checks work as designed.
            They are not a measure of real-world accuracy.
          </p>
          <p className="shrink-0">
            Contains public sector information licensed under the{" "}
            <a
              href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-fg"
            >
              Open Government Licence v3.0
              <ExternalLink aria-hidden className="size-3" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            .
          </p>
        </div>
      </Container>
    </section>
  );
}
