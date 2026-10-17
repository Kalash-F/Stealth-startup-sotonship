import { Capabilities } from "@/components/marketing/capabilities";
import { FinalCta } from "@/components/marketing/final-cta";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Methodology } from "@/components/marketing/methodology";
import { AnomalyShowcase, InvestigationShowcase, NetworkShowcase, OverviewShowcase } from "@/components/marketing/showcases";

export default function HomePage() {
  return (
    <>
      <Hero />
      <OverviewShowcase />
      <InvestigationShowcase />
      <NetworkShowcase />
      <AnomalyShowcase />
      <HowItWorks />
      <Capabilities />
      <Methodology />
      <FinalCta />
    </>
  );
}
