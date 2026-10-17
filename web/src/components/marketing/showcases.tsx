import { CaseStatusLabel, PriorityBadge, PriorityScore } from "@/components/domain/status";
import { FlagItem } from "@/components/domain/flag-list";
import { PriceBandBar } from "@/components/domain/price-band-bar";
import { SyntheticBadge } from "@/components/domain/synthetic-badge";
import { benchmarks } from "@/data/reference";
import { investigationById } from "@/data/investigations";
import { shipments, transactionsForCase } from "@/data/network";
import { formatDate, formatDateShort, formatMoney, formatUnitPrice, formatVariance } from "@/lib/format";
import { Container, Fact, ProductFrame, SectionHeading, sectionY } from "./primitives";
import { NetworkGraph } from "./network-graph";
import { OverviewPreview } from "./overview-preview";

const featured = () => investigationById("CASE-0142")!;

/* ── 1 · Trade intelligence overview ───────────────────────────────── */
export function OverviewShowcase() {
  return (
    <section id="product" aria-labelledby="overview-title" className={`scroll-mt-16 border-b border-border ${sectionY}`}>
      <Container>
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <SectionHeading eyebrow="01 · Trade intelligence overview" id="overview-title" className="min-w-0 lg:col-span-7">
            Start each day with the cases that deserve a person&rsquo;s time
          </SectionHeading>
          <p className="max-w-md text-[16px] leading-relaxed text-fg-muted lg:col-span-4 lg:col-start-9">
            Every invoice is screened, but only flagged ones become cases. The overview ranks open cases by review priority, shows which
            rules are firing and how screening volume is moving, so the queue reflects risk rather than arrival order.
          </p>
        </div>
        <div className="mt-12 md:mt-16">
          <OverviewPreview />
          <p className="mt-3 font-mono text-2xs uppercase tracking-[0.06em] text-fg-subtle">
            Fictional sample workspace · screening volumes are synthetic
          </p>
        </div>
      </Container>
    </section>
  );
}

/* ── 2 · Investigation workspace ───────────────────────────────────── */
export function InvestigationShowcase() {
  const inv = featured();
  const shp = shipments[0];
  const events = ["t2", "t4", "t6", "t9", "t11", "t13"].map((id) => inv.timeline.find((e) => e.id === id)!);
  const note = inv.notes[1];
  const txs = transactionsForCase(inv.id);
  return (
    <section aria-labelledby="workspace-title" className={`border-b border-border bg-surface-2/60 ${sectionY}`}>
      <Container className="grid gap-12 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-4 lg:pt-4"><div className="lg:sticky lg:top-24">
          <SectionHeading eyebrow="02 · Investigation workspace" id="workspace-title">
            From alert to a documented case
          </SectionHeading>
          <p className="mt-6 text-[16px] leading-relaxed text-fg-muted">
            An alert opens a case that already holds the invoice, the shipment, the parties and the payments around it. Analysts add
            notes, request information and record what they have established, with the evidence kept in date order.
          </p>
          <dl className="mt-8 divide-y divide-border border-y border-border text-[14px]">
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-fg-muted">Alert raised</dt>
              <dd className="font-mono text-fg">{formatDate(inv.timeline[1].at)}</dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-fg-muted">Information requested</dt>
              <dd className="font-mono text-fg">{formatDate(inv.timeline[12].at)}</dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-fg-muted">Escalation decision</dt>
              <dd className="text-fg">With the analyst</dd>
            </div>
          </dl>
        </div></div>

        <div className="min-w-0 lg:col-span-8">
          <ProductFrame
            label="Product preview of case CASE-0142 detail, fictional sample data"
            crumbs={["Investigations", inv.id]}
            right={<SyntheticBadge />}
            bodyClassName="p-5 md:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-mono text-xs text-fg-subtle">{inv.id}</p>
                <h3 className="mt-1 text-lg font-semibold leading-snug tracking-tight">{inv.title}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <PriorityBadge band={inv.priority_band} />
                  <CaseStatusLabel status={inv.status} />
                </div>
              </div>
              <PriorityScore band={inv.priority_band} score={inv.priority_score} />
            </div>

            <div className="mt-5 grid gap-px border border-border bg-border md:grid-cols-2">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4 bg-surface p-4">
                <Fact label="Seller">{inv.invoice.seller.name}</Fact>
                <Fact label="Buyer">{inv.invoice.buyer.name}</Fact>
                <Fact label="Invoice">
                  <span className="font-mono text-xs">{inv.invoice.invoice_id}</span>
                </Fact>
                <Fact label="Stated total">
                  <span className="font-mono text-xs tabular">{formatMoney(inv.invoice.stated_total)}</span>
                </Fact>
              </dl>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4 bg-surface p-4">
                <Fact label="Route">{inv.route}</Fact>
                <Fact label="Incoterm">{inv.invoice.incoterm}</Fact>
                <Fact label="Bill of lading">
                  <span className="break-all font-mono text-xs">{shp.bill_of_lading.split(" / ")[0]}</span>
                </Fact>
                <Fact label="Goods">
                  <span className="text-xs">{shp.gross_weight_kg.toLocaleString("en-GB")} kg, {shp.containers.split(" (")[0]}</span>
                </Fact>
              </dl>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-5">
              <div className="md:col-span-3">
                <h4 className="eyebrow">Evidence timeline</h4>
                <ol className="mt-3 border-l border-border-strong">
                  {events.map((e) => (
                    <li key={e.id} className="relative pb-4 pl-4 last:pb-0">
                      <span aria-hidden className="absolute -left-[3px] top-[7px] size-[5px] bg-accent" />
                      <p className="font-mono text-2xs text-fg-subtle">{formatDateShort(e.at)}</p>
                      <p className="text-[13px] font-medium text-fg">{e.title}</p>
                      <p className="text-xs leading-relaxed text-fg-muted">{e.detail}</p>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="space-y-5 md:col-span-2">
                <div>
                  <h4 className="eyebrow">Investigator note</h4>
                  <blockquote className="mt-3 border-l-2 border-accent pl-3 text-xs leading-relaxed text-fg-muted">{note.body}</blockquote>
                </div>
                <div className="border border-border bg-surface p-3">
                  <h4 className="eyebrow">Next action</h4>
                  <p className="mt-2 text-[13px] leading-snug text-fg">{inv.nextAction.label}</p>
                  <p className="mt-2 font-mono text-2xs text-risk-review">Due {formatDate(inv.nextAction.due!)}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-border pt-4">
              <h4 className="eyebrow">Transaction references</h4>
              <ul className="mt-3 grid gap-x-6 gap-y-1.5 font-mono text-xs tabular sm:grid-cols-2">
                {txs.map((t) => (
                  <li key={t.id} className="flex justify-between gap-3">
                    <span className="text-fg-muted">{t.ref}</span>
                    <span className="text-fg">{formatMoney(t.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ProductFrame>
        </div>
      </Container>
    </section>
  );
}

/* ── 3 · Entity relationship intelligence ──────────────────────────── */
export function NetworkShowcase() {
  const points = [
    { n: "1", t: "Money in", d: `Calder Brook Industrial Supplies pays ${formatMoney(391900)} to Orchard Gate in two transfers.` },
    { n: "2", t: "Goods paid for", d: `Only ${formatMoney(5180)} goes to Yongjia Hexa Fasteners, the manufacturer.` },
    { n: "3", t: "Money on", d: `${formatMoney(359300)} moves to Vltava Componenta as “consultancy”, within two days of each receipt.` },
    { n: "4", t: "Same owner", d: "Both companies list D. Ferrant as beneficial owner. Vltava also buys copper far below its comparison range." },
  ];
  return (
    <section aria-labelledby="network-title" className={`border-b border-border ${sectionY}`}>
      <Container>
        <SectionHeading eyebrow="03 · Entity relationship intelligence" id="network-title" className="max-w-3xl">
          Follow the money past the first counterparty
        </SectionHeading>
        <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-fg-muted">
          Documents, shipments and payments are drawn as one network. Money edges are teal, ownership is dashed, and links under review
          are marked in red, so the shape of an arrangement is visible before anyone reads a table.
        </p>
        <div className="mt-12">
          <ProductFrame
            label="Interactive entity relationship graph, fictional sample data"
            crumbs={["Entities", "Orchard Gate network"]}
            right={<SyntheticBadge />}
          >
            <NetworkGraph />
          </ProductFrame>
        </div>
        <ol className="mt-10 grid border-t border-border-strong sm:grid-cols-2 lg:grid-cols-4">
          {points.map((p) => (
            <li key={p.n} className="border-b border-border py-5 sm:pr-6 lg:border-b-0">
              <p className="font-mono text-xs text-accent">{p.n}</p>
              <h3 className="mt-2 text-[15px] font-semibold">{p.t}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-fg-muted">{p.d}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

/* ── 4 · How an anomaly is identified ──────────────────────────────── */
export function AnomalyShowcase() {
  const inv = featured();
  const l1 = inv.invoice.line_items[0];
  const bench = benchmarks[inv.hs6];
  const price = inv.flags[0];
  const related = transactionsForCase(inv.id).filter((t) => t.fromEntityId === "ent-orchard");
  return (
    <section aria-labelledby="anomaly-title" className={`border-b border-border bg-surface-2/60 ${sectionY}`}>
      <Container>
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-5"><div className="lg:sticky lg:top-24">
            <SectionHeading eyebrow="04 · How an anomaly is identified" id="anomaly-title">
              Every flag shows its working
            </SectionHeading>
            <p className="mt-6 text-[16px] leading-relaxed text-fg-muted">
              A flag is never a bare score. For line L1 the workspace sets the declared price against a comparison range, states the
              deviation, checks the route and lists the other transactions that bear on it, so a reviewer can agree or disagree with the
              reasoning.
            </p>
            <p className="mt-4 border-l-2 border-border-strong pl-4 text-[13px] leading-relaxed text-fg-muted">
              Comparison values here are illustrative synthetic data, not market prices.
            </p>
          </div></div>

          <div className="min-w-0 lg:col-span-7">
            <ProductFrame
              label="Product preview of the evidence for invoice line L1, fictional sample data"
              crumbs={["Investigations", inv.id, "Line L1"]}
              right={<SyntheticBadge label="Illustrative range" />}
              bodyClassName="p-5 md:p-6"
            >
              <p className="text-[13px] text-fg-muted">{l1.description} · {l1.quantity.toLocaleString("en-GB")} {l1.unit}</p>

              <div className="mt-5 border border-border bg-surface p-4 md:p-5">
                <PriceBandBar benchmark={bench} stated={l1.unit_price} />
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-4">
                {[
                  ["Declared", `${formatUnitPrice(l1.unit_price)} / unit`],
                  ["Median (illustrative)", `${formatUnitPrice(bench.median)} / unit`],
                  ["Deviation", `${formatVariance(price.variance_pct!)} vs median`],
                  ["Line value", formatMoney(l1.line_total)],
                ].map(([k, v], i) => (
                  <div key={k} className="bg-surface p-3">
                    <dt className="font-mono text-2xs uppercase tracking-[0.06em] text-fg-subtle">{k}</dt>
                    <dd className={`mt-1 font-mono text-[13px] tabular ${i === 2 ? "text-risk-high" : "text-fg"}`}>{v}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div>
                  <h4 className="eyebrow">Route</h4>
                  <p className="mt-2 flex items-center gap-2 font-mono text-[13px]">
                    <span>CN</span><span aria-hidden className="text-fg-subtle">→</span>
                    <span className="text-risk-review">AE</span><span aria-hidden className="text-fg-subtle">→</span>
                    <span>GB</span>
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">
                    Transhipped via Jebel Ali. Comparison medians on the direct and indirect routes are within 6% of each other.
                  </p>
                </div>
                <div>
                  <h4 className="eyebrow">Related transactions</h4>
                  <ul className="mt-2 space-y-1 font-mono text-xs tabular">
                    {related.map((t) => (
                      <li key={t.id} className="flex justify-between gap-3">
                        <span className="text-fg-subtle">{t.ref}</span>
                        <span className="text-fg">{formatMoney(t.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-5 border-t border-border pt-5">
                <h4 className="eyebrow">Why it was flagged</h4>
                <ol className="mt-3 divide-y divide-border">
                  {inv.flags.map((f) => (
                    <li key={f.flag_id} className="py-3 first:pt-0 last:pb-0">
                      <FlagItem flag={f} compact />
                    </li>
                  ))}
                </ol>
              </div>
            </ProductFrame>
          </div>
        </div>
      </Container>
    </section>
  );
}

