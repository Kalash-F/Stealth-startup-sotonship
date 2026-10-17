import Link from "next/link";
import { CaseStatusLabel, EvidenceClassTag, PriorityBadge } from "@/components/domain/status";
import { investigationById } from "@/data/investigations";
import { analystById, severityWeight } from "@/data/reference";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Reveal } from "./motion";
import { Container, SectionIndex, displayClass } from "./primitives";

/** Section F · Designed for investigation, not just detection. An editorial spread. */
export function InvestigationEditorial() {
  const inv = investigationById("CASE-0142")!;
  const linked = inv.relatedCaseIds.map((id) => investigationById(id)!);
  const alternatives = inv.assessment.filter((a) => a.alternative);
  const evidence = ["a1", "a4", "a5"].map((id) => inv.assessment.find((a) => a.id === id)!);
  const lead = inv.notes[1];
  const review = inv.notes[2];
  const reviewer = analystById(review.authorId)!;
  const author = analystById(lead.authorId)!;

  const rows: { n: string; t: string; body: React.ReactNode }[] = [
    {
      n: "I",
      t: "Evidence, graded",
      body: (
        <ul className="grid gap-3">
          {evidence.map((a) => (
            <li key={a.id} className="grid gap-1.5 sm:grid-cols-[10.5rem_1fr] sm:gap-4">
              <span>
                <EvidenceClassTag value={a.class} />
              </span>
              <span className="text-[15px] leading-snug">{a.statement}</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      n: "II",
      t: "Other explanations, kept in view",
      body: (
        <ul className="grid gap-3">
          {alternatives.map((a) => (
            <li key={a.id} className="font-serif text-[1.3rem] italic leading-snug text-fg-muted">
              &ldquo;{a.alternative}&rdquo;
            </li>
          ))}
        </ul>
      ),
    },
    {
      n: "III",
      t: "Linked cases",
      body: (
        <ul className="divide-y divide-border border-y border-border">
          {linked.map((c) => (
            <li key={c.id}>
              <Link href={`/app/investigations/${c.id}`} className="group grid gap-1 py-3 sm:grid-cols-[6.5rem_1fr_auto] sm:items-baseline sm:gap-4">
                <span className="font-mono text-[12.5px] text-fg">{c.id}</span>
                <span className="text-[14.5px] leading-snug text-fg-muted group-hover:text-fg group-hover:underline group-hover:underline-offset-4">{c.title}</span>
                <CaseStatusLabel status={c.status} className="text-[12.5px]" />
              </Link>
            </li>
          ))}
        </ul>
      ),
    },
    {
      n: "IV",
      t: "An investigator’s assessment",
      body: (
        <div className="grid gap-4">
          <blockquote className="border-l-2 border-fg pl-4 text-[15px] leading-relaxed">
            {lead.body}
            <footer className="mt-2 font-mono text-[11px] uppercase tracking-[0.06em] text-fg-subtle">
              {author.name} · {formatDate(lead.at)}
            </footer>
          </blockquote>
          <blockquote className="border-l-2 border-border-strong pl-4 text-[15px] leading-relaxed text-fg-muted">
            {review.body}
            <footer className="mt-2 font-mono text-[11px] uppercase tracking-[0.06em] text-fg-subtle">
              {reviewer.name}, {reviewer.role} · {formatDate(review.at)}
            </footer>
          </blockquote>
        </div>
      ),
    },
  ];

  return (
    <section aria-labelledby="editorial-heading" className="theme-paper bg-bg py-20 text-fg md:py-28 lg:py-36">
      <Container>
        <SectionIndex n="05">Investigation, not just detection</SectionIndex>
        <h2 id="editorial-heading" className={cn(displayClass, "mt-6 max-w-5xl text-[2.6rem] sm:text-6xl lg:text-[5rem]")}>
          A score tells you where to look. <span className="text-fg-muted">It cannot tell you what happened.</span>
        </h2>

        <div className="mt-16 grid gap-14 border-t border-fg pt-10 lg:mt-24 lg:grid-cols-12 lg:gap-0">
          {/* detection */}
          <div className="lg:col-span-4 lg:border-r lg:border-border-strong lg:pr-10">
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-fg-subtle">What detection gives you</p>
            <Reveal>
              <p aria-label={`Priority score ${inv.priority_score} out of 100`} className="mt-6 font-serif text-[11rem] leading-[0.8] tracking-[-0.04em] text-risk-high sm:text-[14rem] lg:text-[15rem]">
                {inv.priority_score}
              </p>
            </Reveal>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <PriorityBadge band={inv.priority_band} />
              <span className="font-mono text-[11px] text-fg-subtle">{inv.flags.length} rules fired · {inv.flags.map((f) => severityWeight[f.severity]).join(" + ")}</span>
            </div>
            <p className="mt-6 max-w-xs text-[15px] leading-relaxed text-fg-muted">
              A number puts this invoice at the top of the queue. It cannot say whether the bolts were special, who owns whom, or what
              the importer will say when asked.
            </p>
          </div>

          {/* investigation */}
          <div className="lg:col-span-8 lg:pl-12">
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-fg-subtle">What an investigation needs</p>
            <ol className="mt-6">
              {rows.map((r, i) => (
                <Reveal as="li" key={r.n} delay={i * 0.05} className="grid gap-4 border-t border-border-strong py-7 first:border-t-0 first:pt-0 md:grid-cols-[3.5rem_13rem_1fr] md:gap-6">
                  <span className="font-serif text-[1.6rem] leading-none text-fg-subtle">{r.n}</span>
                  <h3 className="text-[17px] font-semibold leading-snug">{r.t}</h3>
                  <div className="min-w-0">{r.body}</div>
                </Reveal>
              ))}
            </ol>
          </div>
        </div>

        <div className="mt-16 grid gap-8 border-t border-border-strong pt-10 lg:mt-24 lg:grid-cols-12">
          <blockquote className="lg:col-span-8">
            <p className="text-balance font-serif text-[2.1rem] leading-[1.08] tracking-[-0.01em] sm:text-[2.9rem]">
              A priority score is a reason to look, not proof of wrongdoing. The decision stays with a person.
            </p>
          </blockquote>
          <p className="max-w-sm text-[14px] leading-relaxed text-fg-muted lg:col-span-4">
            The product supports investigators; it does not replace professional judgement or guarantee compliance. Confirmed findings
            are established facts, not verdicts. Comparison ranges are illustrative synthetic data, and every record shown is
            fictional.
          </p>
        </div>
      </Container>
    </section>
  );
}
