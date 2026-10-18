import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Container, displayClass } from "./primitives";

/** Contact · the close: try it now, or ask for a walkthrough. */
export function ContactCta() {
  return (
    <section id="contact" aria-labelledby="contact-heading" className="scroll-mt-16 border-t border-border py-20 md:py-28">
      <Container>
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <h2 id="contact-heading" className={cn(displayClass, "text-[2.6rem] leading-[1.02] sm:text-6xl lg:text-[5rem]")}>
              Check your first invoice now.
            </h2>
          </div>
          <div className="lg:col-span-5">
            <p className="max-w-md text-[16px] leading-relaxed text-fg-muted">
              Try a test invoice or upload your own PDF, no sign-up needed. To see it on your team’s documents, request a demo and we’ll
              walk you through it.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="accent">
                <Link href="/app/checker">Check an invoice</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/request-demo">Request a demo</Link>
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
