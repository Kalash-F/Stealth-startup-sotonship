import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "How the prototype website and demo workspace handle data.",
};

export default function PrivacyPage() {
  return (
    <div className="theme-paper bg-bg text-fg">
      <article className="mx-auto w-full max-w-prose px-4 py-16 sm:px-6 md:py-24">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-tight">Privacy notice</h1>

        <div role="note" className="mt-8 border border-border-strong bg-surface-2 px-4 py-3">
          <p className="text-sm font-medium">Draft placeholder. This is not a legal document.</p>
        </div>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold tracking-tight">About this website</h2>
            <p className="mt-2 text-fg-muted">
              This website is a prototype. It is not a live service and does not offer products to customers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight">Demo workspace</h2>
            <p className="mt-2 text-fg-muted">
              The demo workspace uses fictional data. The companies, people, documents, shipments and payments it shows are
              invented for illustration and do not refer to real entities.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight">Sign-in and demo requests</h2>
            <p className="mt-2 text-fg-muted">
              The sign-in form does not create accounts and does not check credentials. It does not store, log or send what
              you type, and it clears the password field when you submit.
            </p>
            <p className="mt-2 text-fg-muted">
              The demo request form does not store or transmit what you enter. Nothing is sent to us or to any third party.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight">Cookies and analytics</h2>
            <p className="mt-2 text-fg-muted">
              The prototype does not set cookies and does not include analytics or tracking scripts.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight">Future versions</h2>
            <p className="mt-2 text-fg-muted">
              If this service is developed further, this notice will be replaced with one that covers the data it actually
              collects, along with the legal basis, retention periods and contact details a real notice requires.
            </p>
          </section>
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
    </div>
  );
}
