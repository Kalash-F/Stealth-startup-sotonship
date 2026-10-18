import type { Metadata } from "next";
import { Panel } from "@/components/ui/panel";
import { RequestForm } from "./request-form";

export const metadata: Metadata = {
  title: "Request a demo",
  description: "Request a walkthrough of Sentinel's invoice checks and review workspace for trade finance and AML teams.",
};

const covers = [
  "Check invoices like yours and walk through what each flag means and the numbers behind it.",
  "See how flagged invoices become cases: the review queue, the case file and the network view.",
  "Talk through how it would fit your review process, including thresholds, escalation and what your records need to show.",
];

export default function RequestDemoPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 md:py-24">
      <header className="max-w-2xl">
        <p className="eyebrow">For trade finance and AML teams</p>
        <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-tight md:text-5xl">Request a demo</h1>
        <p className="mt-5 text-base leading-relaxed text-fg-muted">
          We&rsquo;ll show the checker on invoices like the ones you review and talk through how it fits your process. Tell
          us about your team.
        </p>
      </header>

      <div className="mt-12 grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-16">
        <section aria-labelledby="covers-heading">
          <h2 id="covers-heading" className="text-lg font-semibold tracking-tight">
            What a demo covers
          </h2>
          <ol className="mt-5 divide-y divide-border border-y border-border">
            {covers.map((item, index) => (
              <li key={item} className="flex gap-4 py-4">
                <span className="font-mono text-xs tabular pt-0.5 text-fg-subtle">{String(index + 1).padStart(2, "0")}</span>
                <span className="text-[15px] leading-relaxed">{item}</span>
              </li>
            ))}
          </ol>
        </section>

        <Panel className="p-5 sm:p-6" aria-labelledby="request-heading">
          <h2 id="request-heading" className="sr-only">
            Demo request form
          </h2>
          <RequestForm />
        </Panel>
      </div>
    </div>
  );
}
