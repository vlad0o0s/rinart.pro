import type { Metadata } from "next";
import { SiteHeader, PROEKTIR_SUBLINKS } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { ProjectDiagram } from "@/components/project-diagram";
import { PricingTimeline } from "@/components/pricing-timeline";
import { HeroSection } from "./hero-section";
import { IntroSection } from "./intro-section";
import { ConceptSection } from "./concept-section";
import { WorkTypesSection } from "./work-types-section";
import { StagesSection } from "./stages-section";
import { SecondStageSection } from "./second-stage-section";
import { ThirdStageSection } from "./third-stage-section";
import { JsonLd } from "@/components/json-ld";
import { proektirovaniePageSchema } from "@/lib/seo/schema";
import { buildPageMetadata } from "@/lib/page-seo";
import { RouteReadyAnnouncer } from "@/components/route-ready-announcer";
import { getSocialLinks } from "@/lib/site-settings";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata("proektirovanie");
}

export default async function ProektirovaniePage() {
  const socialLinks = await getSocialLinks();
  return (
    <>
      <SiteHeader showDesktopNav subLinks={PROEKTIR_SUBLINKS} socialLinks={socialLinks} />
      <main className="min-h-screen bg-white text-neutral-900 antialiased">
        <HeroSection />
        <IntroSection />
        <WorkTypesSection />
        <StagesSection />
        <ConceptSection />
        <ProjectDiagram />
        <SecondStageSection />
        <ThirdStageSection />
        <PricingTimeline />
      </main>
      <Footer />
      <JsonLd schema={proektirovaniePageSchema()} />
      <RouteReadyAnnouncer />
    </>
  );
}

