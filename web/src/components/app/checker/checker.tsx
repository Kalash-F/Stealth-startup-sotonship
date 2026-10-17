"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Bot, FileUp, Loader2, PlayCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { FlagList } from "@/components/domain/flag-list";
import { PriceBandBar } from "@/components/domain/price-band-bar";
import { PriorityBadge, PriorityScore } from "@/components/domain/status";
import { SyntheticBadge } from "@/components/domain/synthetic-badge";
import type { Flag } from "@/data/types";
import { api, ApiError, hsPath, notClassifiedReason, type Health, type Report, type Sample } from "@/lib/api";
import { formatUnitPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

const unitName: Record<string, string> = { u: "unit", l: "litre", kg: "kg" };

const kindLabel: Record<Sample["kind"], string> = {
  anomalous: "planted anomaly",
  hard_negative: "legitimate but unusual",
  clean: "clean",
};

/** The officer's checker: pick a sample or upload a PDF, get the explained review report. */
export function Checker() {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [selected, setSelected] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.health().then(setHealth, (e: ApiError) => setHealthError(e.message));
    api.samples().then(
      (list) => {
        // anomalous first: those are the interesting demos
        const order = { anomalous: 0, hard_negative: 1, clean: 2 } as const;
        const sorted = [...list].sort((a, b) => order[a.kind] - order[b.kind] || a.invoice_id.localeCompare(b.invoice_id));
        setSamples(sorted);
        if (sorted[0]) setSelected(sorted[0].invoice_id);
      },
      () => setSamples([]),
    );
  }, []);

  const run = useCallback(async (label: string, job: () => Promise<Report>) => {
    setBusy(true);
    setError(null);
    try {
      const r = await job();
      setReport(r);
      setSource(label);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong while checking the invoice.");
    } finally {
      setBusy(false);
    }
  }, []);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Upload a PDF invoice.");
      return;
    }
    void run(file.name, () => api.checkUpload(file));
  };

  const sample = samples.find((s) => s.invoice_id === selected);

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr] lg:items-start">
      <div className="grid gap-4">
        <Panel>
          <PanelHeader title="Invoice" description="A bundled synthetic sample, or your own PDF." />
          <div className="grid gap-4 p-4">
            <div className="grid gap-2">
              <label htmlFor="sample" className="text-xs font-medium text-fg-muted">
                Sample invoice
              </label>
              <select
                id="sample"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="h-9 rounded-sm border border-border-strong bg-surface px-2 text-[13px] text-fg"
                disabled={!samples.length}
              >
                {samples.length ? null : <option>No samples available</option>}
                {samples.map((s) => (
                  <option key={s.invoice_id} value={s.invoice_id}>
                    {s.invoice_id} · {kindLabel[s.kind]} · {s.route}
                  </option>
                ))}
              </select>
              {sample ? (
                <p className="text-xs text-fg-subtle">
                  {sample.planted.length ? `Planted: ${sample.planted.join(", ").toLowerCase().replaceAll("_", " ")}` : kindLabel[sample.kind]}
                  {" · "}
                  {sample.n_lines} line{sample.n_lines === 1 ? "" : "s"}, {sample.currency}
                </p>
              ) : null}
              <Button onClick={() => sample && run(sample.invoice_id, () => api.checkSample(sample.invoice_id))} disabled={!sample || busy}>
                {busy ? <Loader2 className="animate-spin" aria-hidden /> : <PlayCircle aria-hidden />}
                Check sample
              </Button>
            </div>

            <div className="flex items-center gap-3 text-2xs uppercase tracking-wider text-fg-subtle">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>

            <div
              className="grid place-items-center gap-2 rounded-sm border border-dashed border-border-strong p-5 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onFile(e.dataTransfer.files[0]);
              }}
            >
              <FileUp className="size-5 text-fg-subtle" aria-hidden />
              <p className="text-[13px] text-fg-muted">Drop a PDF invoice here</p>
              <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()} disabled={busy}>
                Choose file
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(e) => {
                  onFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <p className="text-2xs text-fg-subtle">Max 10 MB. Never upload real customer documents.</p>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Service" description="What this check is running on." />
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 p-4 text-[13px]">
            {healthError ? (
              <dd className="col-span-2 text-risk-high">{healthError}</dd>
            ) : !health ? (
              <dd className="col-span-2 text-fg-subtle">Connecting…</dd>
            ) : (
              <>
                <dt className="text-fg-subtle">Classifier</dt>
                <dd className="flex items-center gap-1.5 text-fg">
                  {health.llm && health.llm !== "offline" ? (
                    <>
                      <Bot className="size-3.5" aria-hidden /> AI, {health.llm.replace(/^[a-z]+:/, "")}
                    </>
                  ) : (
                    "Keyword baseline (AI offline)"
                  )}
                </dd>
                <dt className="text-fg-subtle">Price data</dt>
                <dd>
                  {health.benchmarks === "real" ? (
                    <span className="text-fg">Trade statistics</span>
                  ) : (
                    <Badge tone="review">Mock comparison prices</Badge>
                  )}
                </dd>
              </>
            )}
          </dl>
        </Panel>
      </div>

      <div className="min-w-0">
        {error ? (
          <Panel className="mb-4 border-risk-high/40">
            <p role="alert" className="flex items-start gap-2 p-4 text-[13px] text-risk-high">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
            </p>
          </Panel>
        ) : null}
        {busy && !report ? (
          <Panel className="grid h-64 place-items-center text-[13px] text-fg-muted" aria-busy="true">
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Reading the invoice and checking prices…
            </span>
          </Panel>
        ) : report ? (
          <ReportView report={report} source={source} busy={busy} />
        ) : (
          <Panel className="grid h-64 place-items-center p-6 text-center">
            <div className="grid max-w-sm gap-2">
              <Sparkles className="mx-auto size-5 text-fg-subtle" aria-hidden />
              <p className="text-[13px] text-fg-muted">
                Pick a sample or upload a PDF. Each line is classified to an HS code, priced against comparison data, and run
                through eight red-flag rules. The result is a review priority with reasons, never a fraud verdict.
              </p>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

function ReportView({ report, source, busy }: { report: Report; source: string; busy: boolean }) {
  return (
    <div className={cn("grid gap-4 transition-opacity", busy && "opacity-50")}>
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="grid gap-1">
            <p className="font-mono text-2xs text-fg-subtle">{source}</p>
            <h2 className="text-lg font-semibold tracking-tight text-fg">Invoice {report.invoice_id}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <PriorityBadge band={report.priority_band} />
              <span className="text-xs text-fg-subtle">
                {report.flags.length} flag{report.flags.length === 1 ? "" : "s"} · checked in {(report.processing_ms / 1000).toFixed(1)} s
              </span>
              <SyntheticBadge label="Synthetic test data" />
            </div>
          </div>
          <PriorityScore band={report.priority_band} score={Math.round(report.priority_score)} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Why this priority" description="Each flag says what looked wrong and the numbers behind it." />
        <div className="p-4">
          {report.flags.length ? (
            <FlagList flags={report.flags as unknown as Flag[]} headingLevel="h3" />
          ) : (
            <p className="text-[13px] text-fg-muted">No rule fired. That is not proof the invoice is clean, only that nothing stood out.</p>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Line items" description="What each line was classified as, and its price against the comparison range." />
        <ol className="divide-y divide-border">
          {report.lines.map((line) => {
            const path = hsPath(line.normalisation_note);
            const notClassified = notClassifiedReason(line.normalisation_note);
            return (
              <li key={line.line_id} className="grid gap-3 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[13px] font-medium text-fg">
                    <span className="mr-2 font-mono text-2xs text-fg-subtle">{line.line_id}</span>
                    {line.description}
                  </p>
                  <span className="font-mono text-xs tabular text-fg-muted">
                    {line.quantity.toLocaleString()} {line.unit} × {line.unit_price.toLocaleString()}
                  </span>
                </div>
                <div className="grid gap-1 text-xs">
                  {line.hs6 ? (
                    <p className="text-fg-muted">
                      <span className="font-mono text-fg">HS {line.hs6}</span> {line.hs6_description}
                      <span className="text-fg-subtle"> · confidence {(line.classification_confidence * 100).toFixed(0)}%</span>
                    </p>
                  ) : (
                    <p className="text-risk-review">Not classified{notClassified ? `: ${notClassified}` : ""}. The price check was skipped for this line.</p>
                  )}
                  {path ? <p className="font-mono text-2xs leading-relaxed text-fg-subtle">AI path: {path}</p> : null}
                </div>
                {line.benchmark && line.unit_price_usd ? (
                  <div className="grid gap-1">
                    <PriceBandBar benchmark={line.benchmark} stated={line.unit_price_usd} size="sm" />
                    <p className="text-2xs text-fg-subtle">
                      Stated {formatUnitPrice(line.unit_price_usd)} per {unitName[line.benchmark.unit] ?? line.benchmark.unit} in USD
                      {line.benchmark.route ? `, route ${line.benchmark.route}` : ", global range"}
                      {line.benchmark.is_mock ? " · mock comparison data, not real prices" : ` · ${line.benchmark.sources.join(", ")}`}
                    </p>
                  </div>
                ) : line.hs6 ? (
                  <p className="text-2xs text-fg-subtle">No comparison price for this code yet, so its price was not checked.</p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </Panel>

      {report.warnings.length ? (
        <Panel>
          <PanelHeader title="What was not checked" description="Gaps the officer should know about before relying on this report." />
          <ul className="grid gap-1.5 p-4 text-xs text-fg-muted">
            {report.warnings.map((w) => (
              <li key={w} className="flex gap-2">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-risk-review" aria-hidden />
                {w}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
