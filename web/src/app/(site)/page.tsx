import { ContactCta } from "@/components/marketing/contact-cta";
import { DataProof } from "@/components/marketing/data-proof";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { InvoiceExhibit } from "@/components/marketing/invoice-exhibit";
import { WorkspaceShowcase } from "@/components/marketing/workspace-showcase";

/**
 * Written for a buyer skimming in order: what it does (hero), what you get (product),
 * how (three steps), why trust it (data and results), what happens next (workspace), and how to start.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <InvoiceExhibit />
      <HowItWorks />
      <DataProof />
      <WorkspaceShowcase />
      <ContactCta />
    </>
  );
}
