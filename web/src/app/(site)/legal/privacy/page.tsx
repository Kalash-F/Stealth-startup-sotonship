import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: `What ${brand.name} does with the invoices you check and the information you enter.`,
};

const sections: { title: string; body: string[] }[] = [
  {
    title: "What this covers",
    body: [`This notice covers the ${brand.name} website, the invoice checker and the demo workspace.`],
  },
  {
    title: "Invoices you check",
    body: [
      "When you check an invoice, the PDF is sent to our server and read there. Its text, including any names, addresses and amounts printed on it, may be sent to an AI model provider through OpenRouter to read the line items and classify the goods.",
      "The report is kept in temporary server storage so it can be reopened, and is deleted when that storage is recycled. A copy is kept in your browser so the invoice appears in your workspace queue; clearing this site’s browser storage removes it.",
      "Upload only documents you are allowed to share. If in doubt, use one of the test invoices.",
    ],
  },
  {
    title: "Sign-in and demo requests",
    body: [
      "There are no user accounts yet. The sign-in form does not check, store or send what you type.",
      "The demo request form does not currently store or send what you enter.",
    ],
  },
  {
    title: "Cookies and analytics",
    body: [
      "The site sets no cookies and runs no analytics, advertising or tracking scripts. It keeps the invoices you have checked and your display preference in your browser’s local storage.",
    ],
  },
  {
    title: "Hosting",
    body: ["The website and the checker run on Vercel."],
  },
  {
    title: "Changes",
    body: ["When what we collect changes, we will update this page and the date at the top."],
  },
];

export default function PrivacyPage() {
  return (
    <article className="mx-auto w-full max-w-prose px-4 py-16 sm:px-6 md:py-24">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-tight">Privacy notice</h1>
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
            <Link href="/legal/terms" className="underline-offset-4 hover:underline">
              Terms of use
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
