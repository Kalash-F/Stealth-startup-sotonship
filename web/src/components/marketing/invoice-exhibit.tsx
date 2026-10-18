"use client";

import * as React from "react";
import { PriceBandBar } from "@/components/domain/price-band-bar";
import { PriorityBadge, SeverityTag } from "@/components/domain/status";
import { investigationById } from "@/data/investigations";
import { benchmarks } from "@/data/reference";
import type { Severity } from "@/data/types";
import { formatDate, formatMoney, formatUnitPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Reveal } from "./motion";
import { Container, SectionIndex, displayClass } from "./primitives";

const inv = investigationById("CASE-0142")!;
const bench = benchmarks[inv.hs6];
const [L1, L2, L3] = inv.invoice.line_items;

type Mark = 1 | 2 | 3 | 4 | 5;

/** Numbered in reading order: header fields first, then the lines, then the total. */
const notes: { n: Mark; check: string; severity?: Severity; title: string; body: string }[] = [
  {
    n: 1,
    check: "Origin check",
    severity: "medium",
    title: "The origin contradicts itself",
    body: `“${inv.invoice.country_of_origin}” names a Chinese port and an Emirati country of origin.`,
  },
  {
    n: 2,
    check: "Route check",
    severity: "medium",
    title: "A detour with no price reason",
    body: "The bolts were routed through Jebel Ali, yet they cost about the same shipped direct from China. Typical prices on the two routes are within 6%.",
  },
  {
    n: 3,
    check: "Price check",
    severity: "high",
    title: `Priced at ${Math.round(L1.unit_price / bench.median)}× the typical price`,
    body: `${formatUnitPrice(L1.unit_price)} per bolt, against a median of ${formatUnitPrice(bench.median)} for the same commodity code (HS ${inv.hs6}).`,
  },
  {
    n: 4,
    check: "Description check",
    severity: "medium",
    title: "A line that says nothing",
    body: `${formatMoney(L2.line_total)} described only as “${L2.description}”. It can’t be classified or priced, so it is flagged rather than guessed.`,
  },
  {
    n: 5,
    check: "Result",
    title: `Priority ${inv.priority_score}: review now`,
    body: `${inv.flags.length} flags, weighted by severity, put this invoice at the top of the queue. A reviewer decides what happens next.`,
  },
];

function Pin({ n, active }: { n: Mark; active: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-medium transition-colors",
        active ? "bg-[#b8401f] text-white" : "bg-[#15171b] text-[#fbfaf6]",
      )}
    >
      {n}
    </span>
  );
}

/** A field on the paper invoice that lights up with its note. */
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
        className={cn("grid grid-cols-[1.75rem_1fr] gap-x-3 border-t py-4 transition-colors", active ? "border-risk-high" : "border-border-strong")}
      >
        <span
          aria-hidden
          className={cn(
            "mt-0.5 inline-flex size-6 items-center justify-center rounded-full font-mono text-[11px] transition-colors",
            active ? "bg-risk-high text-white" : "bg-surface-3 text-fg",
          )}
        >
          {note.n}
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
            <span className="sr-only">{note.n}. </span>
            {note.check}
            {note.severity ? (
              <>
                <span aria-hidden>·</span>
                <SeverityTag severity={note.severity} className="font-mono text-[11px]" />
              </>
            ) : null}
          </p>
          <p className="mt-1.5 text-[16px] font-medium leading-snug text-fg">{note.title}</p>
          <p className="mt-1 text-[14px] leading-relaxed text-fg-muted">{note.body}</p>
          {note.n === 3 ? <PriceBandBar benchmark={bench} stated={L1.unit_price} size="sm" className="mt-3" /> : null}
          {note.n === 5 ? <PriorityBadge band={inv.priority_band} score={inv.priority_score} className="mt-3" /> : null}
        </div>
      </div>
    </li>
  );
}

const label = "font-mono text-[10px] uppercase tracking-[0.12em] text-[#6b6f76]";

/** Product · the invoice as the checker sees it: each finding pinned to the field it comes from. */
export function InvoiceExhibit() {
  const [focus, setFocus] = React.useState<Mark | null>(null);
  const money = (v: number) => v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  const f = { focus, setFocus };

  return (
    <section id="product" aria-labelledby="product-heading" className="scroll-mt-16 border-t border-border py-20 md:py-28">
      <Container>
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <SectionIndex n="01">Product</SectionIndex>
            <h2 id="product-heading" className={cn(displayClass, "mt-5 text-[2.4rem] leading-[1.02] sm:text-6xl lg:text-[4.25rem]")}>
              Every flag comes with its reason.
            </h2>
          </div>
          <p className="max-w-md text-[16px] leading-relaxed text-fg-muted lg:col-span-5">
            Each problem is marked on the invoice and explained in plain English, with the numbers behind it. Your reviewer knows what to
            question before opening a spreadsheet.
          </p>
        </div>

        <div className="mt-12 grid gap-10 lg:mt-16 lg:grid-cols-12 lg:gap-12">
          <Reveal className="min-w-0 lg:col-span-7">
            <figure>
              <div className="bg-[#f7f4ec] text-[#15171b] shadow-frame">
                <div className="p-4 sm:p-8 [font-feature-settings:'tnum']">
                  <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-[#d9d3c5] pb-4">
                    <div>
                      <p className={label}>Commercial invoice</p>
                      <p className="mt-2 font-serif text-[1.45rem] leading-none sm:text-[1.65rem]">{inv.invoice.invoice_id}</p>
                    </div>
                    <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 font-mono text-[11px] sm:text-right">
                      <dt className="text-[#6b6f76]">Date</dt>
                      <dd>{formatDate(inv.invoice.invoice_date)}</dd>
                      <dt className="text-[#6b6f76]">Terms</dt>
                      <dd>
                        {inv.invoice.incoterm} {inv.invoice.port_of_discharge?.split(",")[0]}
                      </dd>
                    </dl>
                  </div>

                  <div className="grid gap-4 border-b border-[#d9d3c5] py-4 text-[12.5px] leading-relaxed sm:grid-cols-2 sm:gap-6">
                    <div>
                      <p className={label}>Seller</p>
                      <p className="mt-1 font-medium">{inv.invoice.seller.name}</p>
                      <p className="text-[#555a62]">{inv.invoice.seller.address}</p>
                    </div>
                    <div>
                      <p className={label}>Buyer</p>
                      <p className="mt-1 font-medium">{inv.invoice.buyer.name}</p>
                      <p className="text-[#555a62]">{inv.invoice.buyer.address}</p>
                    </div>
                  </div>

                  <dl className="grid grid-cols-2 gap-4 border-b border-[#d9d3c5] py-4 text-[12px] sm:grid-cols-3">
                    <div className="col-span-2 sm:col-span-1">
                      <dt className={label}>Country of origin</dt>
                      <dd className="mt-1">
                        <Field n={1} {...f}>
                          {inv.invoice.country_of_origin}
                        </Field>
                      </dd>
                    </div>
                    <div>
                      <dt className={label}>Port of loading</dt>
                      <dd className="mt-1">
                        <Field n={2} {...f}>
                          {inv.invoice.port_of_loading}
                        </Field>
                      </dd>
                    </div>
                    <div>
                      <dt className={label}>Discharge</dt>
                      <dd className="mt-1">{inv.invoice.port_of_discharge}</dd>
                    </div>
                  </dl>

                  <table className="mt-3 w-full text-[12px]">
                    <caption className="sr-only">Invoice lines</caption>
                    <thead>
                      <tr className="text-left">
                        <th scope="col" className={cn(label, "pb-2 pr-2 font-normal")}>Line</th>
                        <th scope="col" className={cn(label, "pb-2 font-normal")}>Description</th>
                        <th scope="col" className={cn(label, "hidden pb-2 text-right font-normal sm:table-cell")}>Qty</th>
                        <th scope="col" className={cn(label, "pb-2 pl-2 text-right font-normal sm:pl-3")}>Unit</th>
                        <th scope="col" className={cn(label, "pb-2 pl-2 text-right font-normal sm:pl-3")}>Total</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {[L1, L2, L3].map((l) => (
                        <tr key={l.line_id} className="border-t border-[#e2ddd0] align-top">
                          <td className="py-2.5 pr-2 text-[#6b6f76]">{l.line_id}</td>
                          <td className="py-2.5 pr-2 font-sans sm:pr-3">
                            {l === L2 ? (
                              <Field n={4} {...f}>
                                {l.description}
                              </Field>
                            ) : (
                              l.description
                            )}
                            <span className="mt-0.5 block font-mono text-[11px] text-[#6b6f76] sm:hidden">
                              Qty {l.quantity.toLocaleString("en-GB")}
                            </span>
                          </td>
                          <td className="hidden py-2.5 text-right sm:table-cell">{l.quantity.toLocaleString("en-GB")}</td>
                          <td className="whitespace-nowrap py-2.5 pl-2 text-right sm:pl-3">
                            {l === L1 ? (
                              <Field n={3} {...f}>
                                {money(l.unit_price)}
                              </Field>
                            ) : (
                              money(l.unit_price)
                            )}
                          </td>
                          <td className="py-2.5 pl-2 text-right sm:pl-3">{l.line_total.toLocaleString("en-GB")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-3 flex justify-end border-t-2 border-[#15171b] pt-4">
                    <div className="text-right">
                      <p className={label}>Total due</p>
                      <Field n={5} {...f} className="mt-1 font-mono text-[1.2rem] sm:text-[1.35rem]">
                        {formatMoney(inv.invoice.stated_total)}
                      </Field>
                    </div>
                  </div>
                </div>
              </div>
              <figcaption className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-subtle">
                Sample invoice from the demo workspace · hover a number to find its note
              </figcaption>
            </figure>
          </Reveal>

          <ol className="min-w-0 lg:col-span-5" aria-label="What the check found">
            {notes.map((n) => (
              <Note key={n.n} note={n} {...f} />
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}
