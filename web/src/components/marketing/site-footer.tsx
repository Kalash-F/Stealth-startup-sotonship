import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Logo } from "@/components/domain/logo";
import { brand } from "@/lib/brand";
import { Container } from "./primitives";

const col = "text-[14px] text-fg-muted transition-colors hover:text-fg";

export function SiteFooter() {
  return (
    <footer className="border-t border-border-strong bg-bg">
      <Container className="py-14 md:py-20">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Logo />
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-fg-muted">{brand.descriptor}.</p>
            <p className="mt-6 text-[13px] text-fg-subtle">Company details to follow.</p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:col-span-8">
            <div>
              <h2 className="eyebrow">Product</h2>
              <ul className="mt-4 space-y-2.5">
                <li><Link className={col} href="/#product">Overview</Link></li>
                <li><Link className={col} href="/app">Demo workspace</Link></li>
                <li><Link className={col} href="/sign-in">Sign in</Link></li>
                <li><Link className={col} href="/request-demo">Request a demo</Link></li>
              </ul>
            </div>
            <div>
              <h2 className="eyebrow">Capabilities</h2>
              <ul className="mt-4 space-y-2.5">
                <li><Link className={col} href="/#capabilities">Value analysis</Link></li>
                <li><Link className={col} href="/#capabilities">Route anomalies</Link></li>
                <li><Link className={col} href="/#capabilities">Network analysis</Link></li>
                <li><Link className={col} href="/#capabilities">Case management</Link></li>
              </ul>
            </div>
            <div>
              <h2 className="eyebrow">Method</h2>
              <ul className="mt-4 space-y-2.5">
                <li><Link className={col} href="/#methodology">Methodology</Link></li>
                <li>
                  <a
                    className={`${col} inline-flex items-center gap-1`}
                    href="https://www.gov.uk/guidance/trade-based-money-laundering-tbml-handbook/evidence"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    HMRC TBML handbook: evidence
                    <ExternalLink aria-hidden className="size-3 shrink-0" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h2 className="eyebrow">Legal</h2>
              <ul className="mt-4 space-y-2.5">
                <li><Link className={col} href="/legal/privacy">Privacy</Link></li>
                <li><Link className={col} href="/legal/terms">Terms</Link></li>
              </ul>
            </div>
          </nav>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-border pt-6 text-[12.5px] leading-relaxed text-fg-subtle md:flex-row md:justify-between md:gap-12">
          <p className="max-w-2xl">
            {brand.name} is a prototype. Every company, person, document and payment shown on this site is fictional, and comparison
            ranges are illustrative synthetic data. Nothing here is a compliance determination or legal advice.
          </p>
          <p className="shrink-0">© 2026 {brand.name}</p>
        </div>
      </Container>
    </footer>
  );
}
