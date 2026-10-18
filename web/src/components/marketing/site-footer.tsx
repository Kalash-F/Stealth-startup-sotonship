import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Logo } from "@/components/domain/logo";
import { brand } from "@/lib/brand";
import { Container } from "./primitives";

const col = "text-[14px] text-fg-muted transition-colors hover:text-fg";

function External({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a className={`${col} inline-flex items-center gap-1`} href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <ExternalLink aria-hidden className="size-3 shrink-0" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

export function SiteFooter() {
  return (
    <footer className="theme-night border-t border-border bg-bg text-fg">
      <Container className="py-14 md:py-20">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Logo />
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-fg-muted">{brand.descriptor}.</p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:col-span-8">
            <div>
              <h2 className="eyebrow">Product</h2>
              <ul className="mt-4 space-y-2.5">
                <li><Link className={col} href="/app/checker">Check an invoice</Link></li>
                <li><Link className={col} href="/app">Explore the workspace</Link></li>
                <li><Link className={col} href="/request-demo">Request a demo</Link></li>
                <li><Link className={col} href="/sign-in">Sign in</Link></li>
              </ul>
            </div>
            <div>
              <h2 className="eyebrow">Data</h2>
              <ul className="mt-4 space-y-2.5">
                <li><External href="https://www.uktradeinfo.com/">HMRC trade statistics</External></li>
                <li><External href="https://www.gov.uk/guidance/trade-based-money-laundering-tbml-handbook/evidence">HMRC TBML handbook</External></li>
                <li><External href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/">Open Government Licence</External></li>
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
            {brand.name} flags invoices for review; it does not make compliance decisions. The demo workspace uses fictional companies.
            Contains public sector information licensed under the Open Government Licence v3.0.
          </p>
          <p className="shrink-0">© 2026 {brand.name}</p>
        </div>
      </Container>
    </footer>
  );
}
