import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Terms of use",
  description: `Terms for using the ${brand.name} website, invoice checker and demo workspace.`,
};

const sections: { title: string; body: string[] }[] = [
  {
    title: `What ${brand.name} does`,
    body: [
      `${brand.name} ranks trade invoices for review and explains why each one was flagged. Its output is a review priority with reasons. It is not a finding of wrongdoing, a compliance decision or legal advice, and decisions stay with you.`,
    ],
  },
  {
    title: "Price data",
    body: [
      "Price ranges come from HMRC Overseas Trade Statistics and are used under the Open Government Licence v3.0. HMRC figures can stay provisional for up to 18 months and may be revised.",
    ],
  },
  {
    title: "The demo workspace",
    body: [
      "The cases, companies, people, documents and payments in the demo workspace are fictional. Do not read any of them as a statement about a real person, company or transaction.",
    ],
  },
  {
    title: "What you upload",
    body: [
      "Upload only documents you are entitled to share. The privacy notice explains how uploaded invoices are handled.",
    ],
  },
  {
    title: "Availability",
    body: [`${brand.name} is provided as it is, without a guarantee that it will always be available or error-free, and it may change over time.`],
  },
];

export default function TermsPage() {
  return (
    <article className="mx-auto w-full max-w-prose px-4 py-16 sm:px-6 md:py-24">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-tight">Terms of use</h1>
      <p className="mt-4 text-[14px] text-fg-subtle">Last updated 18 October 2026</p>

      <div className="mt-10 space-y-8 text-[15px] leading-relaxed">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="text-lg font-semibold tracking-tight">{s.title}</h2>
            {s.body.map((p) => (
              <p key={p} className="mt-2 text-fg-muted">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>

      <nav aria-label="Legal pages" className="mt-12 border-t border-border pt-6 text-[13px]">
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          <li>
            <Link href="/legal/privacy" className="underline-offset-4 hover:underline">
              Privacy notice
            </Link>
          </li>
          <li>
            <Link href="/" className="underline-offset-4 hover:underline">
              Back to the website
            </Link>
          </li>
        </ul>
      </nav>
    </article>
  );
}
