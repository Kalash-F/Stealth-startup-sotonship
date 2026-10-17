import { Container, SectionHeading, sectionY } from "./primitives";

const stages = [
  { t: "Review trade information", d: "Invoices, bills of lading and payments are read into one record.", demo: "CASE-0142: OGT-INV-26-0311, three lines, one shipment" },
  { t: "Identify anomalies", d: "Rules compare each line and route against illustrative ranges.", demo: "Line L1 at $2.85 against a $0.031 median" },
  { t: "Connect entities", d: "Counterparties, owners and payments are linked across cases.", demo: "Orchard Gate, Vltava Componenta and D. Ferrant" },
  { t: "Assess evidence", d: "Each observation is classed as an anomaly, risk indicator or confirmed finding.", demo: "Five assessment items, one confirmed" },
  { t: "Document findings", d: "Notes, requests and next actions stay with the case.", demo: "Response due 21 Oct before an escalation decision" },
];

export function HowItWorks() {
  return (
    <section aria-labelledby="how-title" className={`border-b border-border ${sectionY}`}>
      <Container>
        <SectionHeading eyebrow="How it works" id="how-title" className="max-w-2xl">
          Five stages, each one visible in the demo
        </SectionHeading>

        <ol className="relative mt-14 grid gap-0 lg:mt-20 lg:grid-cols-5">
          {/* rail */}
          <span aria-hidden className="absolute left-[15px] top-2 bottom-2 w-px bg-border-strong lg:left-0 lg:right-0 lg:top-[15px] lg:h-px lg:w-auto lg:bottom-auto" />
          {stages.map((s, i) => (
            <li key={s.t} className="relative pb-10 pl-12 last:pb-0 lg:pb-0 lg:pl-0 lg:pr-6 lg:pt-14">
              <span className="absolute left-0 top-0 flex size-[31px] items-center justify-center border border-border-strong bg-bg font-mono text-xs text-fg lg:left-0">
                {i + 1}
              </span>
              <h3 className="text-[16px] font-semibold leading-snug tracking-tight">{s.t}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-fg-muted">{s.d}</p>
              <p className="mt-4 border-t border-border pt-3 text-[12.5px] leading-relaxed text-fg-subtle">
                <span className="eyebrow mb-1 block text-accent">In the demo</span>
                {s.demo}
              </p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
