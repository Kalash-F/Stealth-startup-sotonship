import { investigationById } from "@/data/investigations";
import { benchmarks } from "@/data/reference";
import { brand } from "@/lib/brand";
import { formatUnitPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Container, SectionIndex, displayClass } from "./primitives";

const inv = investigationById("CASE-0142")!;
const L1 = inv.invoice.line_items[0];
const lines = inv.invoice.line_items.length;

const steps = [
  {
    verb: "Read",
    body: `Upload a PDF. ${brand.name} pulls out the parties, ports, origin and every line item, and checks that the sums add up.`,
    out: `${lines} lines read · totals reconcile`,
  },
  {
    verb: "Price",
    body: "Each line is matched to its HS commodity code and placed in the range UK importers actually paid for it, by year and country of origin.",
    out: `L1 · HS ${inv.hs6} · ${formatUnitPrice(L1.unit_price)} vs median ${formatUnitPrice(benchmarks[inv.hs6].median)}`,
  },
  {
    verb: "Explain",
    body: "Eight red-flag checks set a review priority. Every flag names the field, the rule and the numbers, so the reason holds up in an audit.",
    out: `${inv.flags.length} flags · priority ${inv.priority_score} · review now`,
  },
];

const checks = [
  "Price outlier",
  "Value too high for the quantity",
  "Vague description",
  "Origin mismatch",
  "Route without a reason",
  "Arithmetic error",
  "Residential consignee",
  "Low reading confidence",
];

/** How it works · three steps on one screen, each with what it produced for the sample invoice. */
export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-16 border-t border-border py-20 md:py-28">
      <Container>
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <SectionIndex n="02">How it works</SectionIndex>
            <h2 id="how-heading" className={cn(displayClass, "mt-5 text-[2.4rem] leading-[1.02] sm:text-6xl lg:text-[4.25rem]")}>
              From PDF to a ranked, explained review.
            </h2>
          </div>
          <p className="max-w-md text-[16px] leading-relaxed text-fg-muted lg:col-span-5">
            The same three steps a careful reviewer would take, run on every line of every invoice.
          </p>
        </div>

        <ol className="mt-12 grid border-t border-border-strong md:grid-cols-3 lg:mt-16">
          {steps.map((s, i) => (
            <li key={s.verb} className={cn("flex flex-col border-b border-border py-8 md:border-b-0 md:py-10", i > 0 && "md:border-l md:pl-8", i < 2 && "md:pr-8")}>
              <p className="flex items-baseline gap-4">
                <span className="font-serif text-[3rem] leading-none text-accent">{i + 1}</span>
                <span className="text-[22px] font-medium tracking-tight">{s.verb}</span>
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-fg-muted">{s.body}</p>
              <p className="mt-6 border-l-2 border-accent bg-surface px-3 py-2 font-mono text-[12px] text-fg md:mt-auto">
                <span aria-hidden className="text-fg-subtle">→ </span>
                {s.out}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-10 grid gap-6 border-t border-border pt-8 lg:grid-cols-12">
          <h3 className="text-[15px] font-medium lg:col-span-3">Eight checks on every invoice</h3>
          <ul className="flex flex-wrap gap-2 lg:col-span-9">
            {checks.map((c) => (
              <li key={c} className="rounded-xs border border-border-strong px-2.5 py-1 text-[13px] text-fg-muted">
                {c}
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-8 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
          <span className="text-fg">A priority is a reason to look, not a verdict.</span> {brand.name} ranks and explains; the decision stays
          with your reviewer.
        </p>
      </Container>
    </section>
  );
}
