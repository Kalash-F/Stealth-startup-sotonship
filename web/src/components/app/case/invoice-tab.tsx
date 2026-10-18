import Link from "next/link";
import { AlertTriangle, Check, Home } from "lucide-react";
import { PriceBandBar } from "@/components/domain/price-band-bar";
import { SeverityTag } from "@/components/domain/status";
import { SyntheticBadge } from "@/components/domain/synthetic-badge";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { countries, rules } from "@/data/reference";
import { invoiceArithmetic, lineArithmetic, lineVariance } from "@/data/selectors";
import type { Investigation, Party, RuleId } from "@/data/types";
import { formatDate, formatMoney, formatNumber, formatVariance } from "@/lib/format";
import { cn } from "@/lib/utils";

function PartyBlock({ role, party, flagged }: { role: string; party: Party | null; flagged?: boolean }) {
  return (
    <div className="min-w-0 p-4">
      <p className="eyebrow">{role}</p>
      {party ? (
        <>
          <p className="mt-1 text-body font-medium text-fg">
            {party.entityId ? (
              <Link href={`/app/entities?entity=${party.entityId}`} className="hover:underline">
                {party.name}
              </Link>
            ) : (
              party.name
            )}
          </p>
          <p className="mt-0.5 text-small leading-snug text-fg-muted">{party.address}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{countries[party.country]?.short ?? party.country}</Badge>
            {party.address_type === "residential" ? (
              <Badge tone={flagged ? "review" : "neutral"}>
                <Home className="size-3" aria-hidden /> Residential address
              </Badge>
            ) : (
              <Badge tone="outline">{party.address_type === "commercial" ? "Commercial address" : "Address type unknown"}</Badge>
            )}
          </div>
        </>
      ) : (
        <p className="mt-1 text-body text-fg-subtle">Not stated. Goods consigned to the buyer.</p>
      )}
    </div>
  );
}

export function InvoiceTab({ inv }: { inv: Investigation }) {
  const i = inv.invoice;
  const flaggedRules = new Set<RuleId>(inv.flags.map((f) => f.rule));
  const arith = invoiceArithmetic(inv);
  const lineMismatches = i.line_items.filter((l) => !lineArithmetic(l).matches);
  // Invoices checked in the workspace carry the real trade-data bands they were compared against.
  const realBands = i.line_items.some((l) => l.benchmark && !l.benchmark.is_mock);

  const header = [
    { label: "Invoice date", value: formatDate(i.invoice_date) },
    { label: "Country of origin", value: i.country_of_origin ?? "Not stated", flag: flaggedRules.has("GEO_INCONSISTENT") },
    { label: "Port of loading", value: i.port_of_loading ?? "Not stated" },
    { label: "Port of discharge", value: i.port_of_discharge ?? "Not stated" },
    { label: "Incoterm", value: i.incoterm ?? "Not stated" },
    { label: "Currency", value: i.currency },
    { label: "Source file", value: i.source_file },
  ];

  return (
    <div className="grid gap-4">
      <Panel>
        <PanelHeader
          title={
            <>
              Invoice <span className="font-mono">{i.invoice_id}</span>
            </>
          }
          description="Fields as extracted from the document"
          actions={i.is_synthetic ? <SyntheticBadge label="Synthetic document" /> : undefined}
        />
        <div className="grid divide-y divide-border border-b border-border md:grid-cols-3 md:divide-x md:divide-y-0">
          <PartyBlock role="Seller" party={i.seller} />
          <PartyBlock role="Buyer" party={i.buyer} />
          <PartyBlock role="Consignee" party={i.consignee} flagged={flaggedRules.has("RESIDENTIAL_CONSIGNEE")} />
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 p-4 sm:grid-cols-4">
          {header.map((h) => (
            <div key={h.label} className="min-w-0">
              <dt className="eyebrow">{h.label}</dt>
              <dd className={cn("mt-1 break-words font-mono text-small", h.flag ? "text-risk-review" : "text-fg")}>
                {h.flag ? <AlertTriangle className="mr-1 inline size-3.5 align-[-2px]" aria-label="Flagged" /> : null}
                {h.value}
              </dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel>
        <PanelHeader
          title="Line items"
          description={
            realBands
              ? "Stated unit price against the comparison band from trade data for the line's HS6 code (log scale)"
              : "Stated unit price against an illustrative comparison band for the line's HS6 code (log scale)"
          }
          actions={realBands ? undefined : <SyntheticBadge label="Illustrative synthetic band" />}
        />
        <ol className="divide-y divide-border">
          {i.line_items.map((l) => {
            const v = lineVariance(l);
            const a = lineArithmetic(l);
            const flags = inv.flags.filter((f) => f.line_id === l.line_id);
            return (
              <li key={l.line_id} className="grid gap-3 px-4 py-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-mono text-small text-fg-subtle">{l.line_id}</span>
                      <h3 className="text-body font-medium text-fg">{l.description}</h3>
                    </div>
                    <p className="mt-0.5 font-mono text-meta text-fg-subtle">
                      {l.hs6 ? `HS ${l.hs6} · ${v?.benchmark.description ?? ""}` : "Unclassified: description too vague to assign an HS code"}
                      {" · "}
                      <span className={l.extraction_confidence < 0.5 ? "text-risk-review" : undefined}>
                        read confidence {l.extraction_confidence.toFixed(2)}
                      </span>
                    </p>
                  </div>
                  <dl className="grid grid-cols-3 gap-x-5 text-right font-mono text-small tabular lg:min-w-[380px]">
                    <div>
                      <dt className="text-meta text-fg-subtle">Quantity</dt>
                      <dd className="text-fg">
                        {formatNumber(l.quantity)} <span className="text-fg-subtle">{l.unit}</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-meta text-fg-subtle">Unit price</dt>
                      <dd className="text-fg">{formatMoney(l.unit_price, i.currency, { decimals: l.unit_price < 1 ? 3 : 2 })}</dd>
                    </div>
                    <div>
                      <dt className="text-meta text-fg-subtle">Line total</dt>
                      <dd className={a.matches ? "text-fg" : "text-risk-review"}>{formatMoney(l.line_total, i.currency)}</dd>
                      {!a.matches ? <dd className="text-meta text-risk-review">computed {formatMoney(a.computed, i.currency)}</dd> : null}
                    </div>
                  </dl>
                </div>

                {v ? (
                  <div className="grid gap-2 rounded-sm border border-border bg-surface-2/40 p-3 md:grid-cols-[minmax(0,1fr)_150px] md:items-center md:gap-5">
                    <PriceBandBar benchmark={v.benchmark} stated={l.unit_price_usd!} />
                    <div className="text-left md:text-right">
                      <p className="text-meta text-fg-subtle">vs {v.benchmark.is_mock ? "illustrative " : ""}median</p>
                      <p className={cn("font-mono text-title tabular", v.outside ? "text-risk-high" : "text-risk-low")}>
                        {formatVariance(v.pct)}
                      </p>
                      <p className="text-meta text-fg-subtle">
                        {v.outside ? "▲ Outside p10–p90" : "● Within p10–p90"} · per {v.benchmark.unit}
                        {l.unit_price_usd !== l.unit_price ? `, converted from per ${l.unit.replace(/s$/, "")}` : ""}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-sm border border-dashed border-border px-3 py-2 text-small text-fg-muted">
                    No comparison possible: the line cannot be classified, so there is no band to compare against.
                  </p>
                )}

                {flags.length ? (
                  <ul className="flex flex-wrap gap-2" aria-label={`Flags on line ${l.line_id}`}>
                    {flags.map((f) => (
                      <li key={f.flag_id} className="inline-flex items-center gap-2 text-small text-fg-muted">
                        <SeverityTag severity={f.severity} />
                        {rules[f.rule].name}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ol>
      </Panel>

      <Panel>
        <PanelHeader title="Arithmetic check" description="Quantity × unit price per line, and the sum of lines against the stated total" />
        <PanelBody className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <dl className="grid max-w-md grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 font-mono text-body tabular">
            {i.line_items.map((l) => (
              <div key={l.line_id} className="contents">
                <dt className="text-fg-muted">Line {l.line_id}</dt>
                <dd className="text-right text-fg">{formatMoney(l.line_total, i.currency)}</dd>
              </div>
            ))}
            <dt className="border-t border-border pt-1.5 text-fg-muted">Sum of lines</dt>
            <dd className="border-t border-border pt-1.5 text-right text-fg">{formatMoney(arith.sumOfLines, i.currency)}</dd>
            <dt className="text-fg-muted">Stated total</dt>
            <dd className="text-right text-fg">{formatMoney(arith.stated, i.currency)}</dd>
            <dt className="text-fg-muted">Difference</dt>
            <dd className={cn("text-right", arith.matches ? "text-fg-subtle" : "text-risk-review")}>
              {formatMoney(arith.difference, i.currency)}
            </dd>
          </dl>
          <div className="grid gap-2">
            <p className={cn("inline-flex items-center gap-2 text-body", arith.matches ? "text-risk-low" : "text-risk-review")}>
              {arith.matches ? <Check className="size-4" aria-hidden /> : <AlertTriangle className="size-4" aria-hidden />}
              {arith.matches ? "Total reconciles with its lines" : "Total does not reconcile with its lines"}
            </p>
            <p className={cn("inline-flex items-center gap-2 text-body", lineMismatches.length ? "text-risk-review" : "text-risk-low")}>
              {lineMismatches.length ? <AlertTriangle className="size-4" aria-hidden /> : <Check className="size-4" aria-hidden />}
              {lineMismatches.length
                ? `Line ${lineMismatches.map((l) => l.line_id).join(", ")}: quantity × price does not match the line total`
                : "Every line: quantity × price matches the line total"}
            </p>
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}
