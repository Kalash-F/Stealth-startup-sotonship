import { EvidenceClassTag, evidenceClassMeta } from "@/components/domain/status";
import type { EvidenceClass } from "@/data/types";
import { investigationById } from "@/data/investigations";
import { Container, SectionHeading, sectionY } from "./primitives";

const walk = [
  { t: "Initial signal", d: "Line L1 is priced about 92 times the median of the illustrative range. Screened on 5 Aug 2026, priority 85." },
  { t: "Supporting evidence", d: "Gross weight of 2,640 kg fits ordinary M8 bolts, and USD 5,180 paid to the manufacturer is close to what the range implies." },
  { t: "Connected entities", d: "A registry extract lists D. Ferrant as beneficial owner of both Orchard Gate and Vltava Componenta." },
  { t: "Alternative explanations", d: "A specialist grade could justify a premium; the origin text could be a template error. The importer has been asked." },
  { t: "Analyst assessment", d: "Pending. The escalation decision is held until the response is due on 21 Oct 2026, and a person makes it." },
];

export function Methodology() {
  const inv = investigationById("CASE-0142")!;
  const example: Record<EvidenceClass, string> = {
    anomaly: inv.assessment.find((a) => a.class === "anomaly")!.statement,
    indicator: inv.assessment.find((a) => a.class === "indicator")!.statement,
    finding: inv.assessment.find((a) => a.class === "finding")!.statement,
  };
  const classes: EvidenceClass[] = ["anomaly", "indicator", "finding"];

  return (
    <section id="methodology" aria-labelledby="method-title" className={`scroll-mt-16 border-b border-border ${sectionY}`}>
      <Container>
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionHeading eyebrow="Evidence and methodology" id="method-title">
              Several indicators, never one rule
            </SectionHeading>
            <p className="mt-6 text-[16px] leading-relaxed text-fg-muted">
              A single odd price proves nothing. The workspace weighs price, description, geography, route and payment behaviour
              together, then shows the reasoning so a reviewer can test it. Here is how the sample case unfolds.
            </p>
          </div>
          <ol className="lg:col-span-7 lg:col-start-6">
            {walk.map((w, i) => (
              <li key={w.t} className="grid grid-cols-[2.5rem_1fr] gap-4 border-t border-border py-5 first:border-t-0 first:pt-0">
                <span className="font-mono text-xs text-fg-subtle">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="text-[15px] font-semibold">{w.t}</h3>
                  <p className="mt-1 text-[14px] leading-relaxed text-fg-muted">{w.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-16 md:mt-24">
          <h3 className="eyebrow">Three words, three different weights</h3>
          <dl className="mt-5 grid border-y border-border-strong md:grid-cols-3">
            {classes.map((c) => (
              <div key={c} className="border-b border-border py-6 last:border-b-0 md:border-b-0 md:border-r md:px-6 md:first:pl-0 md:last:border-r-0 md:last:pr-0">
                <dt><EvidenceClassTag value={c} /></dt>
                <dd className="mt-3 text-[14px] leading-relaxed text-fg">{evidenceClassMeta[c].definition}</dd>
                <dd className="mt-3 text-xs leading-relaxed text-fg-subtle">In CASE-0142: {example[c]}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-16 grid gap-8 md:mt-20 lg:grid-cols-12">
          <blockquote className="lg:col-span-7">
            <p className="text-balance font-serif text-3xl leading-[1.12] tracking-[-0.01em] sm:text-4xl">
              A priority score is a reason to look, not proof of wrongdoing.
            </p>
          </blockquote>
          <p className="max-w-md text-[14px] leading-relaxed text-fg-muted lg:col-span-4 lg:col-start-9">
            The product supports investigators; it does not replace professional judgement or guarantee compliance. Confirmed findings
            are established facts, not verdicts. Comparison ranges are illustrative synthetic data, and every record in the demo is fictional.
          </p>
        </div>
      </Container>
    </section>
  );
}
