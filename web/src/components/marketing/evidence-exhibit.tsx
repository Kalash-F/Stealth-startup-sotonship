"use client";

import * as React from "react";
import { EvidenceClassTag } from "@/components/domain/status";
import { PriceBandBar } from "@/components/domain/price-band-bar";
import { investigationById } from "@/data/investigations";
import { benchmarks } from "@/data/reference";
import { transactions } from "@/data/network";
import type { EvidenceClass } from "@/data/types";
import { formatDate, formatDateShort, formatMoney, formatUnitPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Reveal } from "./motion";
import { Container, SectionIndex, displayClass } from "./primitives";

const inv = investigationById("CASE-0142")!;
const bench = benchmarks[inv.hs6];
const [L1, L2, L3] = inv.invoice.line_items;
const sum = (ids: string[]) => transactions.filter((t) => ids.includes(t.id)).reduce((s, t) => s + t.amount, 0);
const IN = sum(["TX-1", "TX-3"]);
const OUT = sum(["TX-2", "TX-5"]);

type Mark = 1 | 2 | 3 | 4 | 5;

const notes: { n: Mark; cls: EvidenceClass; title: string; body: string; side: "left" | "right" }[] = [
  {
    n: 1,
    cls: "indicator",
    title: "An unusual invoice value",
    body: `Bolts at ${formatUnitPrice(L1.unit_price)} each, about ${Math.round(L1.unit_price / bench.median)}× the illustrative median of ${formatUnitPrice(bench.median)}.`,
    side: "left",
  },
  {
    n: 2,
    cls: "anomaly",
    title: "A description that says nothing",
    body: `${formatMoney(L2.line_total)} of goods described only as “${L2.description}”. Gross weight of 2,640 kg fits ordinary M8 bolts, not a premium product.`,
    side: "left",
  },
  {
    n: 3,
    cls: "anomaly",
    title: "A route without a reason",
    body: "Origin printed as “Ningbo, United Arab Emirates”. Loaded at Ningbo, re-shipped from Jebel Ali, though comparison medians on both routes sit within 6%.",
    side: "right",
  },
  {
    n: 4,
    cls: "indicator",
    title: "Payments forwarded on",
    body: `${formatMoney(OUT)} of the ${formatMoney(IN)} paid against this total moved to Vltava Componenta within 48 hours of each receipt.`,
    side: "right",
  },
  {
    n: 5,
    cls: "finding",
    title: "The evidence that connects them",
    body: "Registry extracts list D. Ferrant as beneficial owner of the seller and of the company that received the money.",
    side: "right",
  },
];

function Pin({ n, active }: { n: Mark; active: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-medium transition-colors",
        active ? "bg-risk-high text-white" : "bg-[#15171b] text-[#fbfaf6]",
      )}
    >
      {n}
    </span>
  );
}

/** A field on the paper invoice that lights up with its annotation. */
function Field({ n, focus, setFocus, className, children }: { n: Mark; focus: Mark | null; setFocus: (m: Mark | null) => void; className?: string; children: React.ReactNode }) {
  const active = focus === n;
  return (
    <span
      onMouseEnter={() => setFocus(n)}
      onMouseLeave={() => setFocus(null)}
      className={cn(
        "relative -mx-1 inline-flex items-start gap-1.5 rounded-[2px] px-1 transition-colors",
        active ? "bg-[#f6dcd2] outline outline-1 outline-[#b8401f]" : "",
        className,
      )}
    >
      <span className="min-w-0">{children}</span>
      <Pin n={n} active={active} />
    </span>
  );
}

function Note({ note, focus, setFocus }: { note: (typeof notes)[number]; focus: Mark | null; setFocus: (m: Mark | null) => void }) {
  const active = focus === note.n;
  return (
    <li>
      <div
        tabIndex={0}
        onMouseEnter={() => setFocus(note.n)}
        onMouseLeave={() => setFocus(null)}
        onFocus={() => setFocus(note.n)}
        onBlur={() => setFocus(null)}
        className={cn(
          "group grid w-full cursor-default gap-2 border-t py-5 text-left transition-colors",
          active ? "border-risk-high" : "border-border-strong",
        )}
      >
        <span className="flex items-center gap-3">
          <span className={cn("font-mono text-[11px] transition-colors", active ? "text-risk-high" : "text-fg-subtle")}>0{note.n}</span>
          <EvidenceClassTag value={note.cls} />
        </span>
        <span className="text-[17px] font-medium leading-snug text-fg">{note.title}</span>
        <span className="text-[14px] leading-relaxed text-fg-muted">
          {note.body}
        </span>
        {note.n === 1 ? (
          <div className="mt-1">
            <PriceBandBar benchmark={bench} stated={L1.unit_price} size="sm" />
          </div>
        ) : null}
        {note.n === 4 ? (
          <span className="mt-1 block" aria-hidden>
            <span className="flex h-2 w-full overflow-hidden bg-surface-3">
              <span className="h-full bg-risk-high" style={{ width: `${(OUT / IN) * 100}%` }} />
            </span>
            <span className="mt-1.5 flex justify-between font-mono text-[10.5px] text-fg-subtle">
              <span>Paid on {Math.round((OUT / IN) * 100)}%</span>
              <span>Received {formatMoney(IN)}</span>
            </span>
          </span>
        ) : null}
      </div>
    </li>
  );
}

const milestones = ["t2", "t3", "t4", "t6", "t11", "t13"].map((id) => inv.timeline.find((e) => e.id === id)!);

/** Section C · From anomaly to evidence: the invoice as an annotated exhibit. */
export function EvidenceExhibit() {
  const [focus, setFocus] = React.useState<Mark | null>(null);
  const money = (v: number) => v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  const f = { focus, setFocus };

  return (
    <section id="evidence" aria-labelledby="evidence-heading" className="theme-night scroll-mt-16 overflow-hidden bg-bg py-20 text-fg md:py-28 lg:py-36">
      <Container>
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <SectionIndex n="02">From anomaly to evidence</SectionIndex>
            <h2 id="evidence-heading" className={cn(displayClass, "mt-6 text-[2.6rem] sm:text-6xl lg:text-[5rem]")}>
              Five observations.
              <br />
              <em className="text-fg-muted">One line of reasoning.</em>
            </h2>
          </div>
          <p className="max-w-md text-[16px] leading-relaxed text-fg-muted lg:col-span-4 lg:col-start-9">
            The flag is where an investigation starts, not where it ends. Each observation is marked on the document it comes from,
            classed by how firmly it is established, and kept with the evidence for it.
          </p>
        </div>

        <div className="mt-14 grid gap-10 lg:mt-20 lg:grid-cols-12 lg:gap-8">
          <ol className="order-2 min-w-0 lg:order-1 lg:col-span-3 lg:pt-24">
            {notes.filter((n) => n.side === "left").map((n) => (
              <Note key={n.n} note={n} {...f} />
            ))}
          </ol>

          {/* the exhibit */}
          <Reveal className="order-1 min-w-0 lg:order-2 lg:col-span-6">
            <figure className="relative">
              <div className="absolute -inset-x-3 -top-3 bottom-3 border border-border" aria-hidden />
              <div className="relative overflow-x-auto bg-[#f7f4ec] text-[#15171b] shadow-frame">
                <div className="min-w-[520px] p-6 sm:p-9 [font-feature-settings:'tnum']">
                  <div className="flex items-start justify-between gap-6 border-b border-[#d9d3c5] pb-5">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#63676d]">Commercial invoice</p>
                      <p className="mt-2 font-serif text-[1.65rem] leading-none">{inv.invoice.invoice_id}</p>
                    </div>
                    <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-right font-mono text-[11px]">
                      <dt className="text-[#63676d]">Date</dt>
                      <dd>{formatDate(inv.invoice.invoice_date)}</dd>
                      <dt className="text-[#63676d]">Terms</dt>
                      <dd>{inv.invoice.incoterm} {inv.invoice.port_of_discharge?.split(",")[0]}</dd>
                    </dl>
                  </div>

                  <div className="grid grid-cols-2 gap-6 border-b border-[#d9d3c5] py-5 text-[12.5px] leading-relaxed">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#63676d]">Seller</p>
                      <Field n={5} {...f} className="mt-1 font-medium">
                        {inv.invoice.seller.name}
                      </Field>
                      <p className="text-[#555a62]">{inv.invoice.seller.address}</p>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#63676d]">Buyer</p>
                      <p className="mt-1 font-medium">{inv.invoice.buyer.name}</p>
                      <p className="text-[#555a62]">{inv.invoice.buyer.address}</p>
                    </div>
                  </div>

                  <dl className="grid grid-cols-3 gap-4 border-b border-[#d9d3c5] py-4 text-[12px]">
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#63676d]">Country of origin</dt>
                      <dd className="mt-1">
                        <Field n={3} {...f}>{inv.invoice.country_of_origin}</Field>
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#63676d]">Port of loading</dt>
                      <dd className="mt-1">{inv.invoice.port_of_loading}</dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#63676d]">Discharge</dt>
                      <dd className="mt-1">{inv.invoice.port_of_discharge}</dd>
                    </div>
                  </dl>

                  <table className="mt-4 w-full text-[12px]">
                    <caption className="sr-only">Invoice lines</caption>
                    <thead>
                      <tr className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#63676d]">
                        <th scope="col" className="pb-2 text-left font-normal">Line</th>
                        <th scope="col" className="pb-2 text-left font-normal">Description</th>
                        <th scope="col" className="pb-2 text-right font-normal">Qty</th>
                        <th scope="col" className="pb-2 text-right font-normal">Unit</th>
                        <th scope="col" className="pb-2 text-right font-normal">Total</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {[L1, L2, L3].map((l) => (
                        <tr key={l.line_id} className="border-t border-[#e2ddd0] align-top">
                          <td className="py-2.5 pr-2 text-[#63676d]">{l.line_id}</td>
                          <td className="py-2.5 pr-3 font-sans">
                            {l === L2 ? <Field n={2} {...f}>{l.description}</Field> : l.description}
                          </td>
                          <td className="py-2.5 text-right">{l.quantity.toLocaleString("en-GB")}</td>
                          <td className="py-2.5 pl-3 text-right">
                            {l === L1 ? <Field n={1} {...f}>{money(l.unit_price)}</Field> : money(l.unit_price)}
                          </td>
                          <td className="py-2.5 pl-3 text-right">{l.line_total.toLocaleString("en-GB")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-4 flex items-end justify-between gap-6 border-t-2 border-[#15171b] pt-4">
                    <p className="max-w-[16rem] text-[11px] leading-relaxed text-[#63676d]">Fictional document generated for the sample workspace.</p>
                    <div className="text-right">
                      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#63676d]">Total due</p>
                      <Field n={4} {...f} className="mt-1 font-mono text-[1.35rem]">
                        {formatMoney(inv.invoice.stated_total)}
                      </Field>
                    </div>
                  </div>
                </div>
              </div>
              <figcaption className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-subtle">
                Exhibit · {inv.invoice.source_file} · hover a mark or a note
              </figcaption>
            </figure>
          </Reveal>

          <ol className="order-3 min-w-0 lg:col-span-3">
            {notes.filter((n) => n.side === "right").map((n) => (
              <Note key={n.n} note={n} {...f} />
            ))}
          </ol>
        </div>

        {/* signal → assessment */}
        <div className="mt-20 lg:mt-28">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h3 className="font-serif text-[1.9rem] leading-tight tracking-[-0.01em] sm:text-[2.4rem]">From signal to assessment</h3>
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
              Priority {inv.priority_score} · review now · decision held for the importer&rsquo;s reply
            </p>
          </div>
          <ol className="mt-8 grid border-t border-border-strong sm:grid-cols-3 lg:grid-cols-7">
            {milestones.map((m, i) => (
              <Reveal as="li" key={m.id} delay={i * 0.06} className="relative border-b border-border py-5 pr-5 lg:border-b-0">
                <span aria-hidden className="absolute -top-[4px] left-0 size-[7px] bg-accent" />
                <p className="font-mono text-[11px] text-fg-subtle">{formatDateShort(m.at)}</p>
                <p className="mt-2 text-[14px] font-medium leading-snug text-fg">{m.title}</p>
              </Reveal>
            ))}
            <Reveal as="li" delay={0.4} className="relative py-5">
              <span aria-hidden className="absolute -top-[4px] left-0 size-[7px] border border-risk-review bg-bg" />
              <p className="font-mono text-[11px] text-risk-review">Due {formatDateShort(inv.nextAction.due!)}</p>
              <p className="mt-2 text-[14px] font-medium leading-snug text-fg">An investigator decides on escalation</p>
            </Reveal>
          </ol>
        </div>
      </Container>
    </section>
  );
}
