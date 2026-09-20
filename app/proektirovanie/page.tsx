import type { Metadata } from "next";
import { SiteHeader, PROEKTIR_SUBLINKS } from "@/components/site-header";
import { getMainNavLinks } from "@/lib/navigation";
import { Footer } from "@/components/footer";
import { PricingTimeline } from "@/components/pricing-timeline";
import { HeroSection } from "./hero-section";
import { IntroSection } from "./intro-section";
import { ConceptSection } from "./concept-section";
import { WorkTypesSection } from "./work-types-section";
import { StagesSection } from "./stages-section";
import { SecondStageSection } from "./second-stage-section";
import { ThirdStageSection } from "./third-stage-section";
import { CasesSection } from "./cases-section";
import { JsonLd } from "@/components/json-ld";
import { proektirovaniePageSchema } from "@/lib/seo/schema";
import { buildPageMetadata } from "@/lib/page-seo";
import { RouteReadyAnnouncer } from "@/components/route-ready-announcer";
import { getSocialLinks } from "@/lib/site-settings";
import { getGlobalBlocks } from "@/lib/global-blocks";
import { getAllProjects } from "@/lib/projects";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata("proektirovanie");
}

export default async function ProektirovaniePage() {
  const [socialLinks, blocks, navLinks, projects] = await Promise.all([
    getSocialLinks(),
    getGlobalBlocks(),
    getMainNavLinks(),
    getAllProjects(),
  ]);
  return (
    <>
      <SiteHeader showDesktopNav subLinks={PROEKTIR_SUBLINKS} socialLinks={socialLinks} navLinks={navLinks} />
      <main className="min-h-screen bg-white text-neutral-900 antialiased site-shell">
        <HeroSection />
        <IntroSection />
        <WorkTypesSection />
        <StagesSection />
        <ConceptSection />
        <SecondStageSection />
        <ThirdStageSection />
        {/* Кейсы связывают услугу с доказательствами: раньше со страницы проектирования
            не было ни одной ссылки на работы бюро. */}
        <CasesSection projects={projects} />
        <PricingTimeline data={blocks.pricing} />
      </main>
      <Footer />
      <JsonLd schema={proektirovaniePageSchema()} />
      <RouteReadyAnnouncer />
    </>
  );
}

