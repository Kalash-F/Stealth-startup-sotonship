"use client";

import { investigationById } from "@/data/investigations";
import { benchmarks } from "@/data/reference";
import { transactions } from "@/data/network";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useActiveStep } from "./motion";
import { Container, SectionIndex, displayClass } from "./primitives";

/* ── Figures, all derived from the sample data ─────────────────────── */

const inv = investigationById("CASE-0142")!;
const bench = benchmarks[inv.hs6];
const sum = (ids: string[]) => transactions.filter((t) => ids.includes(t.id)).reduce((s, t) => s + t.amount, 0);
const IN = sum(["TX-1", "TX-3"]);
const MAKER = sum(["TX-4"]);
const OUT = sum(["TX-2", "TX-5"]);
const HELD = IN - MAKER - OUT;
const bolts = inv.invoice.line_items.filter((l) => l.hs6 === inv.hs6);
const boltCount = bolts.reduce((s, l) => s + l.quantity, 0);
const boltInvoiced = bolts.reduce((s, l) => s + l.line_total, 0);
const boltAtMedian = Math.round(bolts.reduce((s, l) => s + l.quantity * bench.median, 0) / 100) * 100;

const steps = [
  {
    k: "An ordinary invoice",
    t: "On its own, nothing looks wrong.",
    d: `A Jebel Ali trading company invoices a Tamworth fixings distributor ${formatMoney(inv.invoice.stated_total)} for ${boltCount.toLocaleString("en-GB")} zinc-plated bolts, shipped CIF Felixstowe. The importer pays in two instalments. Every document is complete.`,
  },
  {
    k: "The goods are cheap",
    t: "The bolts are worth a fraction of the invoice.",
    d: `The bill of lading shows 2,640 kg of standard M8 bolts. At the illustrative comparison median they are worth about ${formatMoney(boltAtMedian)}, against ${formatMoney(boltInvoiced)} invoiced for them.`,
  },
  {
    k: "The money moves on",
    t: "Almost nothing reaches the factory.",
    d: `The intermediary pays the manufacturer ${formatMoney(MAKER)}. Within 48 hours of each receipt it sends ${formatMoney(OUT)} to a company in Plzeň, as “consultancy services”.`,
  },
  {
    k: "The owner is the same",
    t: "The link nobody invoiced.",
    d: "Registry extracts list the same beneficial owner, D. Ferrant, for the Jebel Ali intermediary and the Plzeň company. Value has crossed from the UK to the Czech Republic under cover of a bolt invoice.",
  },
];

/* ── Diagram geometry (viewBox units) ──────────────────────────────── */

const W = 880;
const H = 600;
const BAND = 180; // height of USD 391,900
const k = BAND / IN;
const col = { calder: 70, orchard: 380, out: 690 };
const top = 250;
const hMaker = Math.max(MAKER * k, 1.5);
const hOut = OUT * k;
const hHeld = HELD * k;
const yMaker = 168; // the manufacturer sits up on the goods lane
const yOut = top + 48;
const yHeld = yOut + hOut + 34;
const NODE = 10;

/** A filled ribbon between two vertical edges. */
function ribbon(x0: number, y0: number, x1: number, y1: number, h: number) {
  const mx = (x0 + x1) / 2;
  return `M${x0} ${y0}C${mx} ${y0} ${mx} ${y1} ${x1} ${y1}L${x1} ${y1 + h}C${mx} ${y1 + h} ${mx} ${y0 + h} ${x0} ${y0 + h}Z`;
}

function Diagram({ step }: { step: number }) {
  const show = (n: number) => (step >= n ? "opacity-100" : "opacity-0");
  const label = "font-mono text-[11px] uppercase tracking-[0.08em]";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-labelledby="ftm-title ftm-desc">
      <title id="ftm-title">Goods and money in the sample case</title>
      <desc id="ftm-desc">
        {`Goods move from the manufacturer to the importer. ${formatMoney(IN)} moves from the importer to the intermediary, which pays ${formatMoney(MAKER)} to the manufacturer and ${formatMoney(OUT)} to a related company with the same owner.`}
      </desc>
      <defs>
        <marker id="ftm-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L8 4L0 8z" fill="var(--fg-muted)" />
        </marker>
      </defs>

      {/* lane labels */}
      <g className={cn(label, "fill-fg-subtle")}>
        <text x={0} y={72}>Goods</text>
        <text x={0} y={top - 28}>Money</text>
      </g>
      <line x1={0} x2={W} y1={top - 52} y2={top - 52} stroke="var(--border)" strokeDasharray="2 5" />

      {/* goods lane: right to left */}
      <g className="transition-opacity duration-700">
        <line x1={col.out - 8} x2={col.calder + 16} y1={96} y2={96} stroke="var(--fg-muted)" strokeWidth={1.25} strokeDasharray="4 5" markerEnd="url(#ftm-arrow)" />
        <text x={(col.out + col.calder) / 2} y={84} textAnchor="middle" className="fill-fg-muted font-mono text-[11px]">
          SHP-0142 · 2,640 kg · Ningbo → Jebel Ali → Felixstowe
        </text>
        <g className={cn("transition-opacity duration-700", step === 1 ? "opacity-100" : "opacity-0")}>
          <rect x={(col.out + col.calder) / 2 - 150} y={110} width={300} height={34} fill="var(--bg)" stroke="var(--border-strong)" />
          <text x={(col.out + col.calder) / 2} y={132} textAnchor="middle" className="fill-fg text-[13px]">
            {`Worth about ${formatMoney(boltAtMedian)} at the median`}
          </text>
        </g>
      </g>

      {/* nodes */}
      <g>
        <rect x={col.out} y={60} width={NODE} height={yMaker + 22 - 60} fill="var(--fg)" />
        <text x={col.out + NODE + 12} y={76} className="fill-fg text-[14px] font-semibold">Yongjia Hexa</text>
        <text x={col.out + NODE + 12} y={93} className="fill-fg-subtle text-[12px]">Manufacturer · Ningbo</text>

        <rect x={col.calder - NODE} y={top} width={NODE} height={BAND} fill="var(--fg)" />
        <rect x={col.calder - NODE} y={60} width={NODE} height={70} fill="var(--fg)" />
        <text x={col.calder - NODE} y={top + BAND + 26} className="fill-fg text-[14px] font-semibold">Calder Brook</text>
        <text x={col.calder - NODE} y={top + BAND + 43} className="fill-fg-subtle text-[12px]">Importer · Tamworth</text>

        <rect x={col.orchard - NODE / 2} y={top} width={NODE} height={BAND} fill="var(--fg)" />
        <text x={col.orchard} y={top + BAND + 26} textAnchor="middle" className="fill-fg text-[14px] font-semibold">Orchard Gate</text>
        <text x={col.orchard} y={top + BAND + 43} textAnchor="middle" className="fill-fg-subtle text-[12px]">Intermediary · Jebel Ali</text>
      </g>

      {/* the invoice: a document running against the money */}
      <g className={cn("transition-opacity duration-700", step <= 1 ? "opacity-100" : "opacity-30")}>
        <line x1={col.orchard - 8} x2={col.calder + 6} y1={top - 14} y2={top - 14} stroke="var(--fg-subtle)" strokeWidth={1} markerEnd="url(#ftm-arrow)" />
        <text x={(col.orchard + col.calder) / 2} y={top - 22} textAnchor="middle" className="fill-fg-muted font-mono text-[11px]">
          OGT-INV-26-0311 · {formatMoney(inv.invoice.stated_total)}
        </text>
      </g>

      {/* money in */}
      <g className={cn("transition-opacity duration-700", step >= 0 ? "opacity-100" : "opacity-0")}>
        <path d={ribbon(col.calder, top, col.orchard - NODE / 2, top, BAND)} fill="var(--accent)" fillOpacity={step >= 2 ? 0.28 : 0.16} className="transition-[fill-opacity] duration-700" />
        <text x={(col.calder + col.orchard) / 2} y={top + BAND / 2 + 5} textAnchor="middle" className="fill-fg font-mono text-[15px]">
          {formatMoney(IN)}
        </text>
      </g>

      {/* money on */}
      <g className={cn("transition-opacity duration-700", show(2))}>
        <path d={ribbon(col.orchard + NODE / 2, top, col.out, yMaker - hMaker / 2, hMaker)} fill="var(--accent)" fillOpacity={0.9} />
        <path
          d={ribbon(col.orchard + NODE / 2, top + hMaker, col.out, yOut, hOut)}
          fill={step >= 3 ? "var(--risk-high)" : "var(--accent)"}
          fillOpacity={step >= 3 ? 0.4 : 0.28}
          className="transition-[fill,fill-opacity] duration-700"
        />
        <path d={ribbon(col.orchard + NODE / 2, top + hMaker + hOut, col.out - 120, yHeld, hHeld)} fill="var(--fg-subtle)" fillOpacity={0.25} />

        <rect x={col.out} y={yOut} width={NODE} height={hOut} fill={step >= 3 ? "var(--risk-high)" : "var(--fg)"} className="transition-[fill] duration-700" />
        <text x={col.out - 12} y={yOut + hOut / 2 - 4} textAnchor="end" className="fill-fg font-mono text-[15px]">{formatMoney(OUT)}</text>
        <text x={col.out - 12} y={yOut + hOut / 2 + 14} textAnchor="end" className="fill-fg-muted font-mono text-[11px]">“CONSULTANCY SERVICES Q3”</text>
        <text x={col.out + NODE + 12} y={yOut + 16} className="fill-fg text-[14px] font-semibold">Vltava</text>
        <text x={col.out + NODE + 12} y={yOut + 33} className="fill-fg text-[14px] font-semibold">Componenta</text>
        <text x={col.out + NODE + 12} y={yOut + 50} className="fill-fg-subtle text-[12px]">Related party</text>
        <text x={col.out + NODE + 12} y={yOut + 65} className="fill-fg-subtle text-[12px]">Plzeň</text>

        <text x={col.out - 12} y={yMaker - 12} textAnchor="end" className="fill-accent font-mono text-[13px]">{formatMoney(MAKER)}</text>
        <text x={col.out - 112} y={yHeld + hHeld / 2 + 4} className="fill-fg-subtle font-mono text-[11px]">
          {formatMoney(HELD)} not traced further
        </text>
      </g>

      {/* ownership */}
      <g className={cn("transition-opacity duration-700", show(3))}>
        <path
          d={`M${col.orchard} ${top + BAND + 58}C${col.orchard} ${H - 12} ${col.out + NODE / 2} ${H - 12} ${col.out + NODE / 2} ${yHeld + hHeld + 14}`}
          fill="none"
          stroke="var(--finding)"
          strokeWidth={1.5}
          strokeDasharray="5 5"
        />
        <rect x={(col.orchard + col.out) / 2 - 104} y={H - 52} width={208} height={26} fill="var(--bg)" />
        <text x={(col.orchard + col.out) / 2 + 3} y={H - 34} textAnchor="middle" className="fill-finding font-mono text-[11px] uppercase tracking-[0.06em]">
          Same owner · D. Ferrant
        </text>
      </g>
    </svg>
  );
}

/** Small screens: one legible figure per step instead of the sticky diagram. */
function StepFigure({ step }: { step: number }) {
  const row = "flex items-baseline justify-between gap-3 font-mono text-[12px]";
  const bar = (w: number, color: string) => <span className="block h-2.5" style={{ width: `${Math.max(w, 0.6)}%`, background: color }} />;
  return (
    <figure className="mt-6 border border-border bg-surface p-4 lg:hidden" aria-hidden>
      {step === 0 ? (
        <div className="grid gap-1.5">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-subtle">Invoice</p>
          <p className="font-serif text-2xl leading-none">{inv.invoice.invoice_id}</p>
          <p className="text-[13px] text-fg-muted">Orchard Gate → Calder Brook · CIF Felixstowe</p>
          <p className="font-mono text-lg">{formatMoney(inv.invoice.stated_total)}</p>
        </div>
      ) : step === 1 ? (
        <div className="grid gap-3">
          <div className="grid gap-1">
            <p className={row}><span className="text-fg-muted">Invoiced for the bolts</span><span>{formatMoney(boltInvoiced)}</span></p>
            {bar(100, "var(--fg)")}
          </div>
          <div className="grid gap-1">
            <p className={row}><span className="text-fg-muted">Worth at the median</span><span className="text-accent">{formatMoney(boltAtMedian)}</span></p>
            {bar((boltAtMedian / boltInvoiced) * 100, "var(--accent)")}
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <p className={row}><span className="text-fg-muted">Received by Orchard Gate</span><span>{formatMoney(IN)}</span></p>
          <span className="flex h-3 w-full overflow-hidden">
            <span style={{ width: `${(OUT / IN) * 100}%`, background: step === 3 ? "var(--risk-high)" : "var(--accent)" }} />
            <span style={{ width: `${Math.max((MAKER / IN) * 100, 0.8)}%`, background: "var(--fg)" }} />
            <span className="flex-1 bg-surface-3" />
          </span>
          <p className={row}><span className="text-fg-muted">To Vltava, “consultancy”</span><span className={step === 3 ? "text-risk-high" : ""}>{formatMoney(OUT)}</span></p>
          <p className={row}><span className="text-fg-muted">To the manufacturer</span><span>{formatMoney(MAKER)}</span></p>
          {step === 3 ? (
            <p className="mt-1 border-t border-dashed border-finding pt-3 font-mono text-[11px] uppercase tracking-[0.06em] text-finding">
              Orchard Gate and Vltava · same owner, D. Ferrant
            </p>
          ) : null}
        </div>
      )}
    </figure>
  );
}

/** Section B · Follow the money. A sticky diagram that a four-step story scrolls past. */
export function FollowTheMoney() {
  const [ref, active] = useActiveStep(steps.length);
  return (
    <section id="follow-the-money" aria-labelledby="ftm-heading" className="theme-paper scroll-mt-16 bg-bg text-fg">
      <Container className="pb-8 pt-20 md:pt-28 lg:pt-32">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <SectionIndex n="01">The hidden pattern</SectionIndex>
            <h2 id="ftm-heading" className={cn(displayClass, "mt-6 text-[2.6rem] sm:text-6xl lg:text-[5.25rem]")}>
              Every record checks out.
              <br />
              <span className="text-fg-muted">The pattern does not.</span>
            </h2>
          </div>
          <p className="max-w-sm text-[16px] leading-relaxed text-fg-muted lg:col-span-4">
            Follow one sample case through four documents. Each is unremarkable. Read together, they show value leaving a trade that
            the goods cannot explain.
          </p>
        </div>
      </Container>

      <Container>
        <div ref={ref} className="relative grid lg:grid-cols-12 lg:gap-10">
          {/* sticky diagram */}
          <div className="sticky top-16 z-10 hidden lg:order-2 lg:block lg:col-span-7 lg:mx-0 lg:h-[calc(100svh-4rem)] lg:border-0 lg:px-0 lg:pt-0">
            <div className="flex h-full flex-col justify-center lg:py-14">
              <div className="mb-3 hidden items-center justify-between font-mono text-[11px] uppercase tracking-[0.08em] text-fg-subtle lg:flex">
                <span>CASE-0142 · fictional</span>
                <span>
                  Step <span className="text-fg">{active + 1}</span> / {steps.length}
                </span>
              </div>
              <div className="min-h-0 flex-1 lg:max-h-[620px] lg:flex-none lg:aspect-[880/600]">
                <Diagram step={active} />
              </div>
            </div>
          </div>

          {/* steps */}
          <ol className="relative lg:order-1 lg:col-span-5">
            {steps.map((s, i) => (
              <li
                key={s.k}
                data-step={i}
                className={cn(
                  "flex flex-col justify-center border-l py-12 pl-6 transition-colors duration-500 lg:min-h-[88svh] lg:pl-10 lg:last:min-h-[70svh]",
                  active === i ? "border-fg" : "border-border",
                )}
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-fg-subtle">
                  <span className={cn(active === i ? "text-accent" : "")}>{String(i + 1).padStart(2, "0")}</span> · {s.k}
                </p>
                <h3 className={cn("mt-4 font-serif text-[2rem] leading-[1.05] tracking-[-0.01em] transition-colors duration-500 sm:text-[2.6rem]", active === i ? "text-fg" : "text-fg-subtle")}>
                  {s.t}
                </h3>
                <p className={cn("mt-4 max-w-md text-[16px] leading-relaxed transition-colors duration-500", active === i ? "text-fg-muted" : "text-fg-subtle")}>{s.d}</p>
                <StepFigure step={i} />
              </li>
            ))}
          </ol>
        </div>
      </Container>
      <div className="h-10 md:h-16" />
    </section>
  );
}
