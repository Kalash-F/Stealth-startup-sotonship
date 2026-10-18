"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { SyntheticBadge } from "@/components/domain/synthetic-badge";
import { ReportView } from "@/components/checker/report-view";
import { API_URL, checkSample, checkUpload, listSamples, type Report, type Sample } from "@/lib/checker-api";
import type { Report as WorkspaceReport } from "@/lib/api";
import { addLiveCase } from "@/lib/live-cases";

export function CheckerClient() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [selected, setSelected] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null); // the case created by the last check
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listSamples()
      .then(setSamples)
      .catch(() => setSamples([]));
  }, []);

  async function run(task: () => Promise<Report>) {
    setLoading(true);
    setError(null);
    try {
      const r = await task();
      setReport(r);
      // Same backend response; this client's older type just leaves out fields it does not show.
      setCaseId(addLiveCase(r as unknown as WorkspaceReport)?.id ?? null); // updates the counts, queue and charts above
    } catch (e) {
      setReport(null);
      setCaseId(null);
      setError(
        e instanceof TypeError
          ? `Cannot reach the API at ${API_URL}. Is "make api" running?`
          : e instanceof Error
            ? e.message
            : "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Panel>
        <PanelHeader
          title="Check an invoice"
          description="Pick a bundled sample or upload a text-based PDF (max 10 MB). Every checked invoice is added to the workspace as a case."
          actions={<SyntheticBadge label="Synthetic invoices" />}
        />
        <PanelBody className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Sample invoice"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="h-9 rounded-sm border border-border-strong bg-surface px-3 text-body text-fg"
          >
            <option value="">Select a sample…</option>
            {samples.map((s) => (
              <option key={s.invoice_id} value={s.invoice_id}>
                {s.invoice_id} · {s.kind} · {s.route}
              </option>
            ))}
          </select>
          <Button
            className="text-body"
            disabled={!selected || loading}
            onClick={() => run(() => checkSample(selected))}
          >
            Check sample
          </Button>
          <span className="text-small text-fg-subtle">or</span>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) run(() => checkUpload(f));
              e.target.value = "";
            }}
          />
          <Button variant="secondary" className="text-body" disabled={loading} onClick={() => fileInput.current?.click()}>
            <Upload aria-hidden />
            Upload PDF
          </Button>
          {loading ? <span className="text-small text-fg-muted">Checking…</span> : null}
        </PanelBody>
      </Panel>

      {error ? (
        <p role="alert" className="rounded-md border border-risk-high/40 px-4 py-3 text-body text-risk-high">
          {error}
        </p>
      ) : null}

      {report ? (
        <>
          <p className="text-body text-fg-muted">
            {caseId ? (
              <>
                Added to the workspace as{" "}
                <Link href={`/app/investigations/${caseId}`} className="font-mono text-fg underline-offset-4 hover:underline">
                  {caseId}
                </Link>
                . The counts, queue and charts on this page have updated.
              </>
            ) : (
              "Nothing was flagged, so no case was created."
            )}
          </p>
          <ReportView report={report} />
        </>
      ) : null}
    </div>
  );
}
