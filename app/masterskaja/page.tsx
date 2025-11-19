import type { Metadata } from "next";
import { SiteHeader, MASTERSKAJA_SUBLINKS } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { MasterskajaHero } from "./hero-section";
import { FounderSection } from "./founder-section";
import { TeamSection } from "./team-section";
import { PublicationsSection } from "./publications-section";
import { JsonLd } from "@/components/json-ld";
import { masterskajaPageSchema } from "@/lib/seo/schema";
import { buildPageMetadata } from "@/lib/page-seo";
import { RouteReadyAnnouncer } from "@/components/route-ready-announcer";
import { getSocialLinks, getFounderBiography, getFounderLeadText } from "@/lib/site-settings";
import { getTeamMembers } from "@/lib/team";
import type { TeamMember } from "@/types/site";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata("masterskaja");
}

export default async function MasterskajaPage() {
  const [socialLinks, rawTeamMembers, founderBiography, founderLeadText] = await Promise.all([getSocialLinks(), getTeamMembers(), getFounderBiography(), getFounderLeadText()]);
  const teamMembers: TeamMember[] = rawTeamMembers.map((member) => {
    const { createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = member;
    void _createdAt;
    void _updatedAt;
    return rest;
  });
  return (
    <>
      <SiteHeader showDesktopNav subLinks={MASTERSKAJA_SUBLINKS} socialLinks={socialLinks} />
      <main className="min-h-screen bg-white text-neutral-900 antialiased">
        <section id="founder">
          <MasterskajaHero />
        </section>
        <section>
          <FounderSection biography={founderBiography} leadText={founderLeadText} />
        </section>
        <section id="team">
          <TeamSection members={teamMembers} />
        </section>
        <section id="publications">
          <PublicationsSection />
        </section>
      </main>
      <Footer />
      <JsonLd schema={masterskajaPageSchema()} />
      <RouteReadyAnnouncer />
    </>
  );
}

