import { EvidenceClassTag, evidenceClassMeta } from "@/components/domain/status";
import { FlagList } from "@/components/domain/flag-list";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { severityWeight } from "@/data/reference";
import type { EvidenceClass, Investigation } from "@/data/types";

const classOrder: EvidenceClass[] = ["finding", "indicator", "anomaly"];

export function SummaryTab({ inv }: { inv: Investigation }) {
  const weights = inv.flags.map((f) => severityWeight[f.severity]).sort((a, b) => b - a);
  const rawSum = weights.reduce((s, w) => s + w, 0);
  const grouped = classOrder
    .map((c) => ({ cls: c, items: inv.assessment.filter((a) => a.class === c) }))
    .filter((g) => g.items.length);

  return (
    <div className="grid gap-4">
      <Panel>
        <PanelHeader title="Case summary" />
        <PanelBody>
          <p className="max-w-3xl text-[14px] leading-relaxed text-fg">{inv.summary}</p>
        </PanelBody>
      </Panel>

      <div className="grid gap-4 2xl:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Why this was flagged"
            description={
              <>
                {inv.flags.length} {inv.flags.length === 1 ? "flag" : "flags"} · priority{" "}
                <span className="font-mono tabular">
                  {weights.join(" + ")} = {rawSum}
                  {rawSum > 100 ? " (capped at 100)" : ""}
                </span>
              </>
            }
          />
          <PanelBody>
            <FlagList flags={inv.flags} headingLevel="h3" />
          </PanelBody>
        </Panel>

        <Panel className="flex flex-col">
          <PanelHeader
            title="Evidence assessment"
            description="How firmly each observation is established, and what else could explain it"
          />
          <div className="flex-1 divide-y divide-border">
            {grouped.map((g) => (
              <section key={g.cls} aria-label={evidenceClassMeta[g.cls].label} className="px-4 py-3">
                <h3 className="sr-only">{evidenceClassMeta[g.cls].label}</h3>
                <ul className="grid gap-4">
                  {g.items.map((a) => (
                    <li key={a.id} className="grid gap-1.5">
                      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                        <EvidenceClassTag value={a.class} />
                        <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-fg">{a.statement}</p>
                      </div>
                      <p className="text-[12.5px] leading-relaxed text-fg-muted">
                        <span className="text-fg-subtle">Basis: </span>
                        {a.basis}
                      </p>
                      {a.alternative ? (
                        <p className="border-l-2 border-border-strong pl-2.5 text-[12.5px] leading-relaxed text-fg-muted">
                          <span className="text-fg-subtle">Alternative explanation: </span>
                          {a.alternative}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <footer className="border-t border-border bg-surface-2/50 px-4 py-3">
            <h3 className="eyebrow mb-2">How to read these labels</h3>
            <dl className="grid gap-2">
              {(["anomaly", "indicator", "finding"] as EvidenceClass[]).map((c) => (
                <div key={c} className="grid gap-1 sm:grid-cols-[176px_1fr] sm:items-start">
                  <dt>
                    <EvidenceClassTag value={c} />
                  </dt>
                  <dd className="text-[12px] leading-relaxed text-fg-muted">{evidenceClassMeta[c].definition}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-[11.5px] text-fg-subtle">The priority score orders the queue. It is not a finding and does not establish wrongdoing.</p>
          </footer>
        </Panel>
      </div>
    </div>
  );
}
