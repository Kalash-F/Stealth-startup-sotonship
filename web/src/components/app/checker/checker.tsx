"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, FileUp, Loader2, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { FlagList } from "@/components/domain/flag-list";
import { PriorityScore } from "@/components/domain/status";
import { SyntheticBadge } from "@/components/domain/synthetic-badge";
import { countries } from "@/data/reference";
import type { Currency, Flag } from "@/data/types";
import { api, ApiError, samplePdfUrl, type Health, type HsInfo, type Report, type Sample } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import { addLiveCase } from "@/lib/live-cases";
import { formatPricePeriod, readableWarnings } from "@/lib/report-text";
import { cn } from "@/lib/utils";
import { InvoiceDocument, type DocumentSource } from "./invoice-document";
import { LineItems } from "./line-items";

const kindLabel: Record<Sample["kind"], string> = {
  anomalous: "planted problems",
  hard_negative: "unusual but legitimate",
  clean: "clean",
};

/** The officer's checker: pick a sample or upload a PDF, then read the report beside the invoice itself. */
export function Checker() {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [selected, setSelected] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [doc, setDoc] = useState<DocumentSource | null>(null);
  const [hs, setHs] = useState<Record<string, HsInfo>>({});
  const [caseId, setCaseId] = useState<string | null>(null); // the case created by the last check
  const [active, setActive] = useState<string | null>(null); // the goods line in focus
  const [zoom, setZoom] = useState(1); // invoice page width, 1 = fit the column
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  // The chosen sample lives in the URL (?sample=ID) so a check can be shared or reloaded.
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const linked = params.get("sample");
  const autoRan = useRef(false);
  const initialSample = useRef(linked); // read once when the samples load

  useEffect(() => {
    api.health().then(setHealth, (e: ApiError) => setHealthError(e.message));
    api.samples().then(
      (list) => {
        // planted problems first: those are the interesting demos
        const order = { anomalous: 0, hard_negative: 1, clean: 2 } as const;
        const sorted = [...list].sort((a, b) => order[a.kind] - order[b.kind] || a.invoice_id.localeCompare(b.invoice_id));
        setSamples(sorted);
        const fromUrl = sorted.find((s) => s.invoice_id === initialSample.current);
        if (fromUrl ?? sorted[0]) setSelected((fromUrl ?? sorted[0]).invoice_id);
      },
      () => setSamples([]),
    );
  }, []);

  // Chapter and heading names and the CN codes under each HS code the report uses.
  useEffect(() => {
    if (!report) return;
    const codes = [...new Set(report.lines.flatMap((l) => [l.hs6, ...l.hs6_candidates.map((c) => c.hs6)]).filter((c): c is string => !!c))];
    if (!codes.length) return;
    let live = true;
    api.hs(codes).then(
      (info) => live && setHs(info),
      () => live && setHs({}),
    );
    return () => {
      live = false;
    };
  }, [report]);

  const run = useCallback(async (label: DocumentSource, job: () => Promise<Report>) => {
    setBusy(true);
    setError(null);
    try {
      const r = await job();
      setHs({});
      setReport(r);
      setDoc(label);
      setActive(null);
      // Every checked invoice becomes a case, so it shows in the attention queue, investigations and counts.
      setCaseId(addLiveCase(r)?.id ?? null);
      resultsRef.current?.focus({ preventScroll: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong while checking the invoice.");
    } finally {
      setBusy(false);
    }
  }, []);

  const checkSample = useCallback(
    (invoiceId: string) => run({ kind: "sample", url: samplePdfUrl(invoiceId), name: `${invoiceId}.pdf` }, () => api.checkSample(invoiceId)),
    [run],
  );

  const choose = (invoiceId: string) => {
    setSelected(invoiceId);
    router.replace(`${pathname}?sample=${encodeURIComponent(invoiceId)}`, { scroll: false });
  };

  // Opening a shared link (?sample=ID) runs that check straight away, once.
  useEffect(() => {
    if (autoRan.current || !linked || selected !== linked) return;
    autoRan.current = true;
    void checkSample(linked);
  }, [linked, selected, checkSample]);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("That file is not a PDF. Upload the invoice as a PDF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("That PDF is larger than 10 MB. Upload a smaller file.");
      return;
    }
    void run({ kind: "upload", file, name: file.name }, () => api.checkUpload(file));
  };

  const selectLine = (id: string) => {
    setActive(id);
    document.getElementById(`line-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const sample = samples.find((s) => s.invoice_id === selected);
  const period = formatPricePeriod(health?.price_period);

  return (
    <div className="grid gap-4">
      {/* What to check */}
      <Panel
        aria-label="Invoice to check"
        className={cn("transition-colors", dragging && "border-fg bg-surface-2")}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onFile(e.dataTransfer.files[0]);
        }}
      >
        <div className="flex flex-wrap items-end gap-3 p-4">
          <div className="grid min-w-0 flex-1 basis-72 gap-1.5">
            <label htmlFor="sample" className="text-small font-medium text-fg">
              Test invoice
            </label>
            <select
              id="sample"
              value={selected}
              onChange={(e) => choose(e.target.value)}
              aria-describedby="sample-hint"
              className="h-11 w-full min-w-0 rounded-sm border border-border-strong bg-surface px-2.5 text-body text-fg"
              disabled={!samples.length}
            >
              {samples.length ? null : <option>No test invoices available</option>}
              {samples.map((s) => (
                <option key={s.invoice_id} value={s.invoice_id}>
                  {s.invoice_id} · {kindLabel[s.kind]} · {s.route.replace("-", " to ")}
                </option>
              ))}
            </select>
          </div>
          <Button size="lg" onClick={() => sample && checkSample(sample.invoice_id)} disabled={!sample || busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <PlayCircle aria-hidden />}
            Check invoice
          </Button>
          <span className="hidden h-11 items-center text-small text-fg-subtle sm:flex" aria-hidden>
            or
          </span>
          <Button size="lg" variant="secondary" onClick={() => fileInput.current?.click()} disabled={busy}>
            <FileUp aria-hidden />
            Upload a PDF
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        <div id="sample-hint" className="flex flex-wrap justify-between gap-x-6 gap-y-1 border-t border-border px-4 py-2.5 text-small text-fg-muted">
          <p>
            {sample
              ? sample.planted.length
                ? `Planted problems: ${sample.planted.join(", ").toLowerCase().replaceAll("_", " ")}. ${sample.n_lines} line${sample.n_lines === 1 ? "" : "s"} in ${sample.currency}.`
                : sample.kind === "hard_negative"
                  ? `Legitimate, but unusual enough to look suspicious. ${sample.n_lines} line${sample.n_lines === 1 ? "" : "s"} in ${sample.currency}.`
                  : `A normal invoice with nothing planted. ${sample.n_lines} line${sample.n_lines === 1 ? "" : "s"} in ${sample.currency}.`
              : "Sixty fictional test invoices are built in; some have problems planted in them."}
          </p>
          <p>Or drop a PDF here, up to 10 MB. Do not upload real customer documents.</p>
        </div>
      </Panel>

      {healthError ? <Alert>The checking service cannot be reached right now. {healthError}</Alert> : null}
      {error ? <Alert>{error}</Alert> : null}

      <div ref={resultsRef} tabIndex={-1} aria-live="polite" aria-busy={busy} className="outline-none">
        {busy && !report ? (
          <Loading />
        ) : report && doc ? (
          <div className={cn("grid gap-4 transition-opacity", busy && "opacity-50")}>
            <ResultHeader report={report} doc={doc} caseId={caseId} />
            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <Panel className="xl:sticky xl:top-4 xl:flex xl:max-h-[calc(100dvh-6.5rem)] xl:flex-col">
                <PanelHeader title="Invoice as received" description={doc.name} actions={<ZoomControl zoom={zoom} onZoom={setZoom} />} />
                <div className="min-h-0 overflow-auto p-3 xl:flex-1">
                  <InvoiceDocument
                    zoom={zoom}
                    source={doc}
                    lines={report.invoice.line_items.map((l) => ({ id: l.line_id, description: l.description }))}
                    flagged={new Set(report.flags.map((f) => f.line_id).filter((id): id is string => !!id))}
                    active={active}
                    onSelectLine={selectLine}
                  />
                </div>
              </Panel>
              <div className="grid min-w-0 gap-4">
                <Findings report={report} />
                <LineItems report={report} hs={hs} active={active} onActive={setActive} />
                <NotChecked warnings={report.warnings} />
                <Sources health={health} period={period} />
              </div>
            </div>
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

const zoomSteps = [1, 1.5, 2];

/** Fit, 150% and 200%: the page is A4, so at column width its small print needs a closer look. */
function ZoomControl({ zoom, onZoom }: { zoom: number; onZoom: (z: number) => void }) {
  return (
    <div role="group" aria-label="Invoice zoom" className="flex items-center rounded-sm border border-border-strong">
      {zoomSteps.map((z) => (
        <button
          key={z}
          type="button"
          aria-pressed={zoom === z}
          onClick={() => onZoom(z)}
          className={cn(
            "h-8 min-w-11 px-2 font-mono text-small tabular transition-colors first:rounded-l-[3px] last:rounded-r-[3px]",
            zoom === z ? "bg-fg text-bg" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
          )}
        >
          {z === 1 ? "Fit" : `${z * 100}%`}
        </button>
      ))}
    </div>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg border border-risk-high/40 bg-surface px-4 py-3 text-body text-risk-high">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function Loading() {
  return (
    <Panel className="grid min-h-64 place-items-center p-6">
      <p className="flex items-center gap-2 text-body text-fg-muted">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Reading the invoice and checking each price…
      </p>
    </Panel>
  );
}

function EmptyState() {
  const steps = [
    ["Read", "Parties, ports, goods lines and totals are read from the PDF."],
    ["Code", "Each goods line is given its customs code (HS, and CN where the HS code settles it)."],
    ["Compare", "Each price is placed against UK import prices for that code, and eight checks look for the usual laundering signs."],
  ];
  return (
    <Panel className="p-6">
      <div className="grid max-w-2xl gap-4">
        <h2 className="text-title font-semibold text-fg">Pick a test invoice, or upload your own.</h2>
        <ol className="grid gap-3">
          {steps.map(([title, body], i) => (
            <li key={title} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2 text-body">
              <span className="font-mono text-fg-subtle tabular">{i + 1}</span>
              <span className="text-fg-muted">
                <span className="font-medium text-fg">{title}.</span> {body}
              </span>
            </li>
          ))}
        </ol>
        <p className="text-body text-fg-muted">
          You get a review priority, the reasons for it, and the invoice beside them to compare. Deciding whether anything is wrong stays with you.
        </p>
      </div>
    </Panel>
  );
}

const countryName = (code: string) => (code && code !== "ZZ" ? (countries[code as keyof typeof countries]?.short ?? code) : "country not read");

function ResultHeader({ report, doc, caseId }: { report: Report; doc: DocumentSource; caseId: string | null }) {
  const inv = report.invoice;
  const to = inv.consignee ?? inv.buyer;
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 p-4">
        <div className="grid min-w-0 max-w-3xl flex-1 basis-80 gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-title font-semibold tracking-tight text-fg">
              Invoice <span className="font-mono">{report.invoice_id}</span>
            </h2>
            {doc.kind === "sample" ? <SyntheticBadge label="Test invoice" /> : <Badge tone="outline">Uploaded</Badge>}
          </div>
          <p className="text-small text-fg-muted">
            {inv.seller.name} ({countryName(inv.seller.country)}) to {to.name} ({countryName(to.country)}) · {formatDate(inv.invoice_date)} ·{" "}
            <span className="font-mono tabular">{formatMoney(inv.stated_total, inv.currency as Currency)}</span>
          </p>
          {report.summary ? <p className="text-body leading-relaxed text-fg [text-wrap:pretty]">{report.summary}</p> : null}
          {caseId ? (
            <p className="text-small text-fg-muted">
              Saved to the workspace as{" "}
              <Link
                href={`/app/investigations/${caseId}`}
                className="inline-flex items-center gap-1 font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
              >
                <span className="font-mono">{caseId}</span>
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </p>
          ) : null}
        </div>
        <PriorityScore band={report.priority_band} score={Math.round(report.priority_score)} />
      </div>
    </Panel>
  );
}

function Findings({ report }: { report: Report }) {
  return (
    <Panel>
      <PanelHeader title="Why it got this priority" description="Worst first. Each reason is a prompt to review, not a finding of fraud." />
      <div className="p-4">
        {report.flags.length ? (
          <FlagList flags={report.flags as unknown as Flag[]} headingLevel="h3" />
        ) : (
          <p className="text-body text-fg-muted">Nothing stood out. That does not prove the invoice is clean.</p>
        )}
      </div>
    </Panel>
  );
}

function NotChecked({ warnings }: { warnings: string[] }) {
  const items = useMemo(() => readableWarnings(warnings), [warnings]);
  if (!items.length) return null;
  return (
    <Panel>
      <PanelHeader title="Not checked" description="Read these before relying on the priority." />
      <ul className="grid gap-2 p-4 text-body text-fg-muted">
        {items.map((w) => (
          <li key={w} className="flex gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-risk-review" aria-hidden />
            {w}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Sources({ health, period }: { health: Health | null; period: string }) {
  if (!health) return null;
  const mock = health.benchmarks === "mock";
  return (
    <footer className="grid gap-1 px-1 text-small leading-relaxed text-fg-muted">
      <p>
        <span className="font-medium text-fg">Prices:</span>{" "}
        {mock ? (
          <>
            <Badge tone="review">Placeholder prices</Badge> not real trade data.
          </>
        ) : (
          <>HMRC Overseas Trade Statistics, UK imports of every commodity code{period ? `, ${period}` : ""}, converted to US dollars at annual average rates.</>
        )}
      </p>
      <p>
        <span className="font-medium text-fg">Codes:</span> the Harmonised System (HS, 6 digits), with the Combined Nomenclature code (CN, 8 digits) where the
        HS code leaves only one.
      </p>
    </footer>
  );
}
