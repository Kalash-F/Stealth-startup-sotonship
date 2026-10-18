"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Check, MousePointerClick, RotateCcw } from "lucide-react";
import { PriceBandBar } from "@/components/domain/price-band-bar";
import { investigationById } from "@/data/investigations";
import { benchmarks, entityById } from "@/data/reference";
import { transactions } from "@/data/network";
import { formatDateShort, formatMoney, formatUnitPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LAND_DOT_GAP, VIEW, at, goodsLegs, landPath, moneyArcs, project, type PlaceId, type Pt } from "./geo";

/* ── What can be selected, and what each selection lights up ─────────── */

type RouteId = "goods1" | "goods2" | "in" | "maker" | "out" | "owner";
type Sel = "invoice" | "out" | "in" | "maker" | "orchard" | "calder" | "yongjia" | "vltava";
type Layer = "goods" | "money" | "owner";

const related: Record<Sel, RouteId[]> = {
  invoice: ["goods1", "goods2", "in"],
  out: ["out", "owner"],
  in: ["in"],
  maker: ["maker", "goods1"],
  orchard: ["in", "maker", "out", "owner"],
  calder: ["in", "goods2"],
  yongjia: ["maker", "goods1"],
  vltava: ["out", "owner"],
};

const involved: Record<Sel, Sel[]> = {
  invoice: ["orchard", "calder"],
  out: ["orchard", "vltava"],
  in: ["calder", "orchard"],
  maker: ["orchard", "yongjia"],
  orchard: ["orchard", "calder", "yongjia", "vltava"],
  calder: ["calder", "orchard"],
  yongjia: ["yongjia", "orchard"],
  vltava: ["vltava", "orchard"],
};

const inv = investigationById("CASE-0142")!;
const bench = benchmarks[inv.hs6];
const L1 = inv.invoice.line_items[0];

const sumTx = (ids: string[]) => transactions.filter((t) => ids.includes(t.id)).reduce((s, t) => s + t.amount, 0);
const txDates = (ids: string[]) => transactions.filter((t) => ids.includes(t.id)).map((t) => formatDateShort(t.at)).join(" · ");

const IN = sumTx(["TX-1", "TX-3"]);
const MAKER = sumTx(["TX-4"]);
const OUT = sumTx(["TX-2", "TX-5"]);

interface Detail {
  kicker: string;
  tone: "risk" | "money" | "neutral";
  title: string;
  figure?: string;
  band?: boolean;
  rows: [string, string][];
  note: string;
  href: string;
  cta: string;
}

function detailFor(sel: Sel): Detail {
  const e = (id: string) => entityById(id)!;
  switch (sel) {
    case "invoice":
      return {
        kicker: "Flagged line · price outlier",
        tone: "risk",
        title: `Line 1: hex bolts M8, ${L1.quantity.toLocaleString("en-GB")} pieces`,
        figure: `${formatUnitPrice(L1.unit_price)} per bolt`,
        band: true,
        rows: [
          ["Line total", formatMoney(L1.line_total)],
          ["Whole invoice", `${inv.flags.length} flags · priority ${inv.priority_score}, review now`],
        ],
        note: "The goods are cheap; the invoice is not. Select a payment on the map to see where the difference went.",
        href: "/#product",
        cta: "See every flag on this invoice",
      };
    case "out":
      return {
        kicker: "Payments under review",
        tone: "risk",
        title: "Orchard Gate → Vltava Componenta",
        figure: formatMoney(OUT),
        rows: [
          ["Narrative", "“Consultancy services Q3”"],
          ["Sent", `${txDates(["TX-2", "TX-5"])}, within 48 h of each receipt`],
          ["Share of receipts", `${Math.round((OUT / IN) * 100)}% of ${formatMoney(IN)}`],
        ],
        note: "Registry extracts list the same beneficial owner, D. Ferrant, for both companies.",
        href: `/app/investigations/${inv.id}`,
        cta: "Open the case",
      };
    case "in":
      return {
        kicker: "Payments for the invoice",
        tone: "money",
        title: "Calder Brook → Orchard Gate",
        figure: formatMoney(IN),
        rows: [
          ["Invoice", `${inv.invoice.invoice_id}, CIF Felixstowe`],
          ["Sent", `${txDates(["TX-1", "TX-3"])}, advance and balance`],
          ["Goods", "160,000 zinc-plated M8 bolts"],
        ],
        note: "On its own, an ordinary payment for an ordinary import.",
        href: `/app/investigations/${inv.id}`,
        cta: "Open the case",
      };
    case "maker":
      return {
        kicker: "Payment for the goods",
        tone: "money",
        title: "Orchard Gate → Yongjia Hexa Fasteners",
        figure: formatMoney(MAKER),
        rows: [
          ["Reference", "PO 26-118 fasteners"],
          ["Sent", txDates(["TX-4"])],
          ["Share of receipts", `${((MAKER / IN) * 100).toFixed(1)}%`],
        ],
        note: "About what the bolts are worth at the typical price.",
        href: `/app/investigations/${inv.id}`,
        cta: "Open the case",
      };
    case "orchard":
    case "calder":
    case "yongjia":
    case "vltava": {
      const ent = e(`ent-${sel}`);
      const role = { intermediary: "Intermediary", importer: sel === "vltava" ? "Related party" : "Importer", manufacturer: "Manufacturer" }[
        ent.kind as "intermediary" | "importer" | "manufacturer"
      ];
      const moved: Record<typeof sel, [string, string][]> = {
        orchard: [
          ["Received", formatMoney(IN)],
          ["Paid on", formatMoney(MAKER + OUT)],
        ],
        calder: [
          ["Paid", formatMoney(IN)],
          ["Received", "2,640 kg of bolts"],
        ],
        yongjia: [
          ["Shipped", "2,640 kg, Ningbo"],
          ["Received", formatMoney(MAKER)],
        ],
        vltava: [
          ["Received", formatMoney(OUT)],
          ["Goods supplied", "None on file"],
        ],
      };
      return {
        kicker: `${role} · ${ent.city}`,
        tone: sel === "vltava" || sel === "orchard" ? "risk" : "neutral",
        title: ent.name,
        rows: moved[sel],
        note: ent.riskNote,
        href: `/app/entities?entity=${ent.id}`,
        cta: "Open in the network view",
      };
    }
  }
}

/* ── Markers ─────────────────────────────────────────────────────────── */

const markers: { sel: Sel; place: PlaceId; entity: string; role: string; align: "left" | "right"; dy?: number }[] = [
  { sel: "calder", place: "tamworth", entity: "Calder Brook", role: "Importer", align: "left", dy: -2 },
  { sel: "vltava", place: "plzen", entity: "Vltava Componenta", role: "Related party", align: "right", dy: -1 },
  { sel: "orchard", place: "jebelAli", entity: "Orchard Gate FZE", role: "Intermediary", align: "left", dy: 1 },
  { sel: "yongjia", place: "ningbo", entity: "Yongjia Hexa", role: "Manufacturer", align: "left", dy: 1.9 },
];

const tags: { sel: Sel; at: Pt; amount: number; label: string; className?: string }[] = [
  // On a phone the two big amounts would overlap; slide this one back up its own route.
  { sel: "in", at: moneyArcs.in.mid, amount: IN, label: "Payment in", className: "max-sm:-ml-[30px] max-sm:-mt-[20px]" },
  { sel: "out", at: moneyArcs.out.mid, amount: OUT, label: "Paid on" },
  { sel: "maker", at: moneyArcs.maker.mid, amount: MAKER, label: "To maker" },
];

const pct = ([x, y]: Pt) => ({ left: `${(x / VIEW.w) * 100}%`, top: `${(y / VIEW.h) * 100}%` });

/* ── Component ───────────────────────────────────────────────────────── */

export function TradeMap({ className }: { className?: string }) {
  const [sel, setSel] = React.useState<Sel>("invoice");
  const [layers, setLayers] = React.useState<Record<Layer, boolean>>({ goods: true, money: true, owner: true });
  const [run, setRun] = React.useState(0);
  const [touched, setTouched] = React.useState(false);
  const choose = (next: Sel) => {
    setTouched(true);
    setSel(next);
  };
  const lit = new Set(related[sel]);
  const detail = detailFor(sel);

  const routeClass = (id: RouteId) => cn("transition-opacity duration-500", lit.has(id) ? "opacity-100" : "opacity-40");
  const toggle = (l: Layer) => setLayers((s) => ({ ...s, [l]: !s[l] }));

  return (
    <div className={cn("relative w-full xl:grid xl:h-full xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-12", className)}>
      <figure className="min-w-0 xl:[container-type:size]">
        <div
          className="relative w-full overflow-hidden xl:ml-auto xl:w-[min(100cqw,calc((100cqh-1.75rem)*var(--ratio)))]"
          style={{ aspectRatio: `${VIEW.w} / ${VIEW.h}`, ["--ratio" as string]: VIEW.w / VIEW.h }}
        >
          <svg
            key={run}
            viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
            className="absolute inset-0 h-full w-full"
            role="img"
            // aria-label, not <title>: a <title> shows as a hover tooltip over the whole hero map.
            aria-label="Map of the sample case: bolts ship from Ningbo through Jebel Ali to Felixstowe, while payments run from Tamworth to Jebel Ali and on to Plzeň."
          >
            <defs>
              <radialGradient id="land-fade" cx="42%" cy="44%" r="64%">
                <stop offset="0.55" stopColor="#fff" stopOpacity="1" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </radialGradient>
              <mask id="land-mask" maskUnits="userSpaceOnUse" x={0} y={0} width={VIEW.w} height={VIEW.h}>
                <rect x={0} y={0} width={VIEW.w} height={VIEW.h} fill="url(#land-fade)" />
              </mask>
            </defs>

            {/* graticule */}
            <g stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" aria-hidden>
              {[0, 20, 40, 60].map((lat) => {
                const [, y] = project(0, lat);
                return <line key={lat} x1={0} x2={VIEW.w} y1={y} y2={y} strokeDasharray="2 6" />;
              })}
              {[-30, 0, 30, 60, 90, 120].map((lon) => {
                const [x] = project(lon, 0);
                return <line key={lon} y1={0} y2={VIEW.h} x1={x} x2={x} strokeDasharray="2 6" />;
              })}
            </g>

            {/* land */}
            <path
              d={landPath}
              mask="url(#land-mask)"
              stroke="var(--fg)"
              strokeOpacity={0.34}
              strokeWidth={3.2}
              strokeLinecap="round"
              strokeDasharray={`0 ${LAND_DOT_GAP}`}
              fill="none"
              aria-hidden
            />

            {/* goods: dashed sea lanes, revealed by a drawn mask */}
            {layers.goods ? (
              <g aria-hidden>
                {(["goods1", "goods2"] as const).map((id, i) => (
                  <g key={id} className={routeClass(id)}>
                    <mask id={`m-${id}`} maskUnits="userSpaceOnUse" x={-200} y={-200} width={VIEW.w + 400} height={VIEW.h + 400}>
                      <path
                        d={id === "goods1" ? goodsLegs.first : goodsLegs.second}
                        pathLength={1}
                        className="draw-path"
                        style={{ ["--delay" as string]: `${0.2 + i * 1.5}s`, ["--dur" as string]: i ? "2.2s" : "1.6s" }}
                        stroke="#fff"
                        strokeWidth={10}
                        fill="none"
                      />
                    </mask>
                    <path
                      d={id === "goods1" ? goodsLegs.first : goodsLegs.second}
                      mask={`url(#m-${id})`}
                      stroke="var(--fg-muted)"
                      strokeWidth={1.25}
                      vectorEffect="non-scaling-stroke"
                      strokeDasharray="3 4"
                      fill="none"
                    />
                  </g>
                ))}
              </g>
            ) : null}

            {/* ownership: the link nobody invoiced */}
            {layers.owner ? (
              <g className={routeClass("owner")} aria-hidden>
                <path
                  d={moneyArcs.owner.d}
                  pathLength={1}
                  className="draw-path"
                  style={{ ["--delay" as string]: "4.6s", ["--dur" as string]: "1.2s" }}
                  stroke="var(--finding)"
                  strokeOpacity={0.75}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  fill="none"
                />
                <path d={moneyArcs.owner.d} stroke="var(--bg)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeDasharray="4 5" fill="none" className="rise-in" style={{ ["--delay" as string]: "4.6s" }} />
              </g>
            ) : null}

            {/* money: clean arcs, width by amount */}
            {layers.money ? (
              <g aria-hidden>
                {(
                  [
                    ["in", moneyArcs.in.d, "var(--accent)", 2.2, 2.6],
                    ["maker", moneyArcs.maker.d, "var(--accent)", 1.25, 3.6],
                    ["out", moneyArcs.out.d, "var(--risk-high)", 2.6, 3.8],
                  ] as const
                ).map(([id, d, color, w, delay]) => (
                  <g key={id} className={routeClass(id)}>
                    <path
                      d={d}
                      pathLength={1}
                      className="draw-path"
                      style={{ ["--delay" as string]: `${delay}s`, ["--dur" as string]: "1.1s" }}
                      stroke={color}
                      strokeWidth={w}
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                      fill="none"
                    />
                    <path
                      d={d}
                      pathLength={1}
                      className="flow-path"
                      style={{ animationDelay: `${delay + 1.1}s`, ["--dur" as string]: id === "maker" ? "9s" : "5s" }}
                      stroke="var(--fg)"
                      strokeWidth={w + 1.5}
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                      fill="none"
                    />
                  </g>
                ))}
              </g>
            ) : null}

            {/* places */}
            {(Object.keys({ ningbo: 1, jebelAli: 1, felixstowe: 1, tamworth: 1, plzen: 1 }) as PlaceId[]).map((p) => {
              const [x, y] = at(p);
              const hot = p === "jebelAli" || p === "plzen";
              return (
                <g key={p} aria-hidden>
                  {hot ? <circle cx={x} cy={y} r={9} fill="none" stroke={p === "plzen" ? "var(--risk-high)" : "var(--accent)"} className="ping" /> : null}
                  <circle cx={x} cy={y} r={p === "felixstowe" ? 3 : 4.5} fill="var(--bg)" stroke={p === "plzen" ? "var(--risk-high)" : "var(--fg)"} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                </g>
              );
            })}
          </svg>

          {/* Felixstowe: port label only */}
          <p
            className="pointer-events-none absolute hidden -translate-x-full whitespace-nowrap pr-2 pt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-subtle sm:block"
            style={pct(at("felixstowe"))}
          >
            Felixstowe
          </p>

          {/* entity markers: a ring that answers hover, so they read as clickable */}
          {markers.map((m) => {
            const active = involved[sel].includes(m.sel);
            const pos = pct(at(m.place));
            return (
              <button
                key={m.sel}
                type="button"
                onClick={() => choose(m.sel)}
                aria-pressed={sel === m.sel}
                aria-label={`${m.entity}, ${m.role}, ${places(m.place)}`}
                className={cn(
                  "group absolute flex -translate-y-1/2 cursor-pointer items-center gap-2 rounded-xs py-1 outline-offset-2 transition-opacity",
                  m.align === "right" ? "-translate-x-[14px] flex-row" : "translate-x-[calc(-100%+14px)] flex-row-reverse text-right",
                  active ? "opacity-100" : "opacity-70 hover:opacity-100",
                )}
                style={{ ...pos, marginTop: m.dy ? `${m.dy}rem` : undefined }}
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-7 shrink-0 rounded-full border transition-colors",
                    sel === m.sel ? "border-fg bg-fg/10" : "border-fg/35 group-hover:border-fg/80 group-hover:bg-fg/5",
                  )}
                />
                <span className="hidden whitespace-nowrap leading-tight sm:block">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-fg-subtle">{places(m.place)}</span>
                  <span
                    className={cn(
                      "block text-[13px] font-medium underline decoration-dotted decoration-fg/40 underline-offset-4",
                      sel === m.sel ? "text-fg" : "text-fg-muted group-hover:text-fg",
                    )}
                  >
                    {m.entity}
                  </span>
                </span>
                <span className="font-mono text-[10px] text-fg-muted sm:hidden">{placeCode(m.place)}</span>
              </button>
            );
          })}

          {/* amount tags on the money routes: solid chips, legible over the land dots */}
          {layers.money
            ? tags.map((t) => (
                <button
                  key={t.sel}
                  type="button"
                  onClick={() => choose(t.sel)}
                  aria-pressed={sel === t.sel}
                  className={cn(
                    "rise-in absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer whitespace-nowrap rounded-xs border px-1.5 py-0.5 font-mono text-[10px] font-medium tabular shadow-frame transition-colors sm:px-2 sm:text-[12px]",
                    t.sel === "out" ? "border-risk-high bg-risk-high-soft text-risk-high" : "border-accent bg-accent-soft text-accent",
                    sel === t.sel ? "ring-2 ring-current ring-offset-1 ring-offset-bg" : "hover:ring-1 hover:ring-current",
                    t.className,
                  )}
                  style={{ ...pct(t.at), ["--delay" as string]: t.sel === "in" ? "3.2s" : t.sel === "maker" ? "4.2s" : "4.4s" }}
                >
                  <span className="sr-only">{t.label}: </span>
                  {formatMoney(t.amount).replace("USD ", "$")}
                </button>
              ))
            : null}
        </div>
        <figcaption className="mt-2 px-4 font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-subtle sm:px-6 xl:px-0">
          Sample case · real ports, fictional companies, illustrative prices
        </figcaption>
      </figure>

      {/* instrument panel: a column beside the map on large screens, below it on small ones */}
      <div className="mt-5 px-4 sm:px-6 xl:mt-0 xl:flex xl:flex-col xl:px-0">
        <p className="flex items-center gap-2 text-[12.5px] text-fg-muted">
          <MousePointerClick aria-hidden className="size-4 shrink-0 text-accent" />
          Select a company or an amount to trace it.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Map layers">
          <LayerToggle on={layers.goods} onClick={() => toggle("goods")} swatch={<span className="w-4 border-t border-dashed border-fg-muted" />}>
            Goods
          </LayerToggle>
          <LayerToggle on={layers.money} onClick={() => toggle("money")} swatch={<span className="h-0.5 w-4 bg-accent" />}>
            Money
          </LayerToggle>
          <LayerToggle on={layers.owner} onClick={() => toggle("owner")} swatch={<span className="w-4 border-t border-dashed border-finding" />}>
            Ownership
          </LayerToggle>
          <button
            type="button"
            onClick={() => {
              setLayers({ goods: true, money: true, owner: true });
              setSel("invoice");
              setTouched(false);
              setRun((r) => r + 1);
            }}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-sm px-2 text-[12px] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <RotateCcw aria-hidden className="size-3.5" /> Replay
          </button>
        </div>
        <DetailCard key={`${sel}-${run}`} detail={detail} delay={touched ? 0 : 0.9} className="mt-3" />
      </div>
    </div>
  );
}

const placeNames: Record<PlaceId, string> = { ningbo: "Ningbo · CN", jebelAli: "Jebel Ali · AE", felixstowe: "Felixstowe · GB", tamworth: "Tamworth · GB", plzen: "Plzeň · CZ" };
const places = (p: PlaceId) => placeNames[p];
const placeCode = (p: PlaceId) => placeNames[p].split(" · ")[1];

/** A layer switch that looks like one: a checkbox square, ticked when the layer is on. */
function LayerToggle({ on, onClick, swatch, children }: { on: boolean; onClick: () => void; swatch: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "inline-flex h-8 cursor-pointer items-center gap-2 rounded-sm border px-2 text-[12px] transition-colors",
        on ? "border-border-strong bg-surface text-fg hover:bg-surface-2" : "border-border text-fg-subtle hover:border-border-strong hover:text-fg-muted",
      )}
    >
      <span
        aria-hidden
        className={cn("inline-flex size-3.5 items-center justify-center rounded-[3px] border", on ? "border-accent bg-accent text-accent-fg" : "border-fg-subtle")}
      >
        {on ? <Check className="size-2.5" strokeWidth={3} /> : null}
      </span>
      <span aria-hidden className="inline-flex w-4 items-center">{swatch}</span>
      {children}
    </button>
  );
}

function DetailCard({ detail, delay, className }: { detail: Detail; delay: number; className?: string }) {
  const tone = detail.tone === "risk" ? "text-risk-high" : detail.tone === "money" ? "text-accent" : "text-fg-muted";
  return (
    <div
      className={cn("rise-in border border-border-strong bg-surface p-4 shadow-frame", className)}
      style={{ ["--delay" as string]: `${delay}s` }}
      aria-live="polite"
    >
      <p className={cn("flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.08em]", tone)}>
        {detail.tone === "risk" ? <span aria-hidden>▲</span> : null}
        {detail.kicker}
      </p>
      <p className="mt-2 text-[15px] font-semibold leading-snug text-fg">{detail.title}</p>
      {detail.figure ? <p className={cn("mt-1 font-mono text-2xl tabular tracking-tight", tone)}>{detail.figure}</p> : null}
      {detail.band ? <PriceBandBar benchmark={bench} stated={L1.unit_price} size="sm" className="mt-3" /> : null}
      <dl className="mt-3 divide-y divide-border border-y border-border text-[12px]">
        {detail.rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-1.5">
            <dt className="shrink-0 text-fg-subtle">{k}</dt>
            <dd className="text-right text-fg">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[12px] leading-relaxed text-fg-muted">{detail.note}</p>
      <Link href={detail.href} className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-fg underline-offset-4 hover:underline">
        {detail.cta} <ArrowUpRight aria-hidden className="size-3.5" />
      </Link>
    </div>
  );
}
