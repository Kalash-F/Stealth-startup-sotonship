import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { FlagList } from "@/components/domain/flag-list";
import { PriorityBadge, PriorityScore } from "@/components/domain/status";
import { SyntheticBadge } from "@/components/domain/synthetic-badge";
import { formatUnitPrice } from "@/lib/format";
import type { Report } from "@/lib/checker-api";

/** The result of one check: headline, flags, lines, warnings. Used by the checker and the live case page. */
export function ReportView({ report }: { report: Report }) {
  const isMock = report.lines.some((l) => l.benchmark?.is_mock);
  return (
    <div className="grid gap-6">
      <Panel>
        <PanelBody className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-small text-fg-subtle">{report.invoice_id}</p>
            <div className="mt-2 flex items-center gap-3">
              <PriorityBadge band={report.priority_band} />
              {isMock ? <SyntheticBadge label="Mock price bands" /> : null}
            </div>
          </div>
          <PriorityScore band={report.priority_band} score={Math.round(report.priority_score)} />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="Flags" description="Worst first. Priority to review, not a verdict of fraud." />
        <PanelBody>
          {report.flags.length ? (
            <FlagList flags={report.flags} headingLevel="h3" />
          ) : (
            <p className="text-body text-fg-muted">No rule fired. Low is not proof the invoice is clean.</p>
          )}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="Lines" description="Stated price against the benchmark band (p10 to p90)." />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body">
            <thead className="text-meta text-fg-subtle">
              <tr>
                <th className="px-4 py-2 font-medium">Line</th>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 font-medium">Qty</th>
                <th className="px-4 py-2 font-medium">Stated (USD/unit)</th>
                <th className="px-4 py-2 font-medium">Expected band</th>
                <th className="px-4 py-2 font-medium">HS6</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono tabular">
              {report.lines.map((l) => (
                <tr key={l.line_id}>
                  <td className="px-4 py-2">{l.line_id}</td>
                  <td className="px-4 py-2 font-sans">{l.description}</td>
                  <td className="px-4 py-2">
                    {l.quantity} {l.unit}
                  </td>
                  <td className="px-4 py-2">
                    {l.unit_price_usd !== null ? `${formatUnitPrice(l.unit_price_usd)}/${l.benchmark_unit ?? "unit"}` : "n/a"}
                  </td>
                  <td className="px-4 py-2">
                    {l.benchmark ? `${formatUnitPrice(l.benchmark.p10)} to ${formatUnitPrice(l.benchmark.p90)}` : "no band"}
                  </td>
                  <td className="px-4 py-2">{l.hs6 ?? "unclassified"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {report.warnings.length ? (
        <Panel>
          <PanelHeader title="Warnings" description="Checks that could not run. Not the same as passed." />
          <PanelBody>
            <ul className="list-disc pl-5 text-body text-fg-muted">
              {report.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </PanelBody>
        </Panel>
      ) : null}
    </div>
  );
}
