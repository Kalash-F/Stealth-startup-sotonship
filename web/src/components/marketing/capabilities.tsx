import { CaseStatusLabel } from "@/components/domain/status";
import { FlagItem } from "@/components/domain/flag-list";
import { PriceBandBar } from "@/components/domain/price-band-bar";
import { benchmarks } from "@/data/reference";
import { investigationById } from "@/data/investigations";
import { transactions } from "@/data/network";
import { formatDate, formatDateShort, formatMoney } from "@/lib/format";
import { Container, SectionHeading, sectionY } from "./primitives";

export function Capabilities() {
  const inv = investigationById("CASE-0142")!;
  const l1 = inv.invoice.line_items[0];
  const tx = transactions.filter((t) => t.id === "TX-2" || t.id === "TX-5");

  const items: { t: string; problem: string; body: string; visual: React.ReactNode }[] = [
    {
      t: "Invoice and trade-value discrepancy analysis",
      problem: "A price can look ordinary on the page and still be far from what the goods trade at.",
      body: "Each line is compared with an illustrative range for its commodity, on a log scale so a 92× outlier and a 15% drift are both readable.",
      visual: <PriceBandBar benchmark={benchmarks[inv.hs6]} stated={l1.unit_price} size="sm" />,
    },
    {
      t: "Trade-route and shipment anomaly detection",
      problem: "Paperwork and physical movement rarely get checked against each other.",
      body: "Origin text, ports and routing are tested for contradictions and for detours that add no commercial value.",
      visual: (
        <div className="font-mono text-xs">
          <p className="flex items-center gap-2 text-[13px]">CN <span aria-hidden className="text-fg-subtle">→</span> <span className="text-risk-review">AE</span> <span aria-hidden className="text-fg-subtle">→</span> GB</p>
          <p className="mt-2 text-fg-muted">Origin reads “Ningbo, United Arab Emirates”</p>
        </div>
      ),
    },
    {
      t: "Counterparty and network analysis",
      problem: "Related companies hide behind separate names and jurisdictions.",
      body: "Shared owners, repeat payers and pass-through payments are drawn as one network that can be followed node by node.",
      visual: (
        <div className="font-mono text-xs leading-relaxed text-fg-muted">
          <p>Orchard Gate</p>
          <p className="my-1 text-accent">↓ {formatMoney(359300)}</p>
          <p>Vltava Componenta</p>
          <p className="mt-2 text-fg-subtle">Shared owner: D. Ferrant</p>
        </div>
      ),
    },
    {
      t: "Duplicate or related transaction identification",
      problem: "Splitting a payment or repeating an invoice can keep each item below notice.",
      body: "Payments with matching narratives and invoices that repeat a pattern are grouped and cross-referenced between cases.",
      visual: (
        <ul className="space-y-1 font-mono text-xs tabular">
          {tx.map((t) => (
            <li key={t.id} className="flex justify-between gap-3 whitespace-nowrap"><span className="text-fg-muted">{formatDateShort(t.at)} · “Consultancy”</span><span>{formatMoney(t.amount)}</span></li>
          ))}
          <li className="pt-1 text-fg-subtle">CASE-0147 repeats the invoice pattern</li>
        </ul>
      ),
    },
    {
      t: "Explainable risk indicators",
      problem: "A score without a reason cannot be challenged, so it cannot be trusted.",
      body: "Every indicator names its rule, shows expected against stated, and says in plain English why it was raised.",
      visual: <FlagItem flag={inv.flags[1]} compact />,
    },
    {
      t: "Investigation case management and evidence documentation",
      problem: "Findings scattered across inboxes and spreadsheets are hard to defend later.",
      body: "Status, owner, notes, requests and the next action live on the case, with an audit-friendly timeline.",
      visual: (
        <div className="space-y-1.5 text-[13px]">
          <CaseStatusLabel status={inv.status} />
          <p className="font-mono text-2xs text-fg-subtle">Next action due {formatDate(inv.nextAction.due!)}</p>
        </div>
      ),
    },
  ];

  return (
    <section id="capabilities" aria-labelledby="cap-title" className={`scroll-mt-16 border-b border-border bg-surface-2/60 ${sectionY}`}>
      <Container className="grid gap-12 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <SectionHeading eyebrow="Capabilities" id="cap-title">
              Six ways the workspace shortens an investigation
            </SectionHeading>
            <p className="mt-6 max-w-sm text-[16px] leading-relaxed text-fg-muted">
              Each capability answers a specific problem investigators describe, and each is shown here with a detail from the sample case.
            </p>
          </div>
        </div>
        <ol className="border-t border-border-strong lg:col-span-8">
          {items.map((it, i) => (
            <li key={it.t} className="grid gap-5 border-b border-border py-7 md:grid-cols-[1fr_16rem] md:gap-8">
              <div>
                <p className="font-mono text-xs text-fg-subtle">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="mt-1 text-[18px] font-semibold leading-snug tracking-tight">{it.t}</h3>
                <p className="mt-2 text-[14px] italic leading-relaxed text-fg-muted">{it.problem}</p>
                <p className="mt-2 text-[14px] leading-relaxed text-fg-muted">{it.body}</p>
              </div>
              <div className="min-w-0 self-start border border-border bg-surface p-3">{it.visual}</div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
