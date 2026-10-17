import { EnterPlatform } from "@/components/marketing/enter-platform";
import { EvidenceExhibit } from "@/components/marketing/evidence-exhibit";
import { FollowTheMoney } from "@/components/marketing/follow-the-money";
import { Hero } from "@/components/marketing/hero";
import { InvestigationEditorial } from "@/components/marketing/investigation-editorial";
import { NetworkSection } from "@/components/marketing/network-section";
import { WorkspaceShowcase } from "@/components/marketing/workspace-showcase";

/**
 * The homepage is one story told in the sample case, CASE-0142:
 * A the hidden pattern (hero) · B follow the money · C anomaly to evidence ·
 * D the workspace · E the network · F investigation, not detection · G enter.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <FollowTheMoney />
      <EvidenceExhibit />
      <WorkspaceShowcase />
      <NetworkSection />
      <InvestigationEditorial />
      <EnterPlatform />
    </>
  );
}
