import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "Terms for using the prototype website and demo workspace.",
};

export default function TermsPage() {
  return (
    <div className="theme-paper bg-bg text-fg">
      <article className="mx-auto w-full max-w-prose px-4 py-16 sm:px-6 md:py-24">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-tight">Terms of use</h1>

        <div role="note" className="mt-8 border border-border-strong bg-surface-2 px-4 py-3">
          <p className="text-sm font-medium">Draft placeholder. This is not a legal document.</p>
        </div>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold tracking-tight">Status of the website</h2>
            <p className="mt-2 text-fg-muted">
              The website and demo workspace are a prototype, provided for evaluation only. They may change or be removed at
              any time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight">Demo workspace</h2>
            <p className="mt-2 text-fg-muted">
              All cases, risk scores, indicators and entities in the demo workspace are fictional. Do not read any of them as a
              finding about a real person, company or transaction.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight">Accounts and sign-in</h2>
            <p className="mt-2 text-fg-muted">
              There are no user accounts in the demo. The sign-in form does not authenticate anyone; use the demo workspace to
              explore the sample data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight">Demo requests</h2>
            <p className="mt-2 text-fg-muted">
              Filling in the demo request form does not create a commitment from either side. The prototype has no submission
              system, so no request reaches anyone.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight">Information you enter</h2>
            <p className="mt-2 text-fg-muted">
              Do not enter real personal, financial or commercial data into the prototype.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight">Warranties, liability and governing law</h2>
            <p className="mt-2 text-fg-muted">
              No terms on warranties, liability or governing law are set out here. They will be written before any real use of
              the service.
            </p>
          </section>
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
    </div>
  );
}
