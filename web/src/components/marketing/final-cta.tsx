import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container, sectionY } from "./primitives";

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className={sectionY}>
      <Container className="grid gap-8 lg:grid-cols-12 lg:items-end">
        <h2
          id="cta-title"
          className="text-balance font-serif text-[2.25rem] leading-[1.04] tracking-[-0.015em] sm:text-5xl lg:col-span-7 lg:text-[3.5rem]"
        >
          Walk through a case with your own team
        </h2>
        <div className="lg:col-span-4 lg:col-start-9">
          <p className="text-[16px] leading-relaxed text-fg-muted">
            We will take compliance and financial crime teams through the sample investigation and talk about how your own trade
            documents and payment data might fit.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" variant="accent">
              <Link href="/request-demo">Request a demo</Link>
            </Button>
            <Button asChild size="lg" variant="link" className="px-0 sm:px-2">
              <Link href="/app">Explore the demo workspace</Link>
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
