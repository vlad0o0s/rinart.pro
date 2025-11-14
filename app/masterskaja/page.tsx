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

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata("masterskaja");
}

export default function MasterskajaPage() {
  return (
    <>
      <SiteHeader showDesktopNav showDesktopBrand={false} subLinks={MASTERSKAJA_SUBLINKS} />
      <main className="min-h-screen bg-white text-neutral-900 antialiased">
        <section id="founder">
          <MasterskajaHero />
        </section>
        <section>
          <FounderSection />
        </section>
        <section id="team">
          <TeamSection />
        </section>
        <section id="publications">
          <PublicationsSection />
        </section>
      </main>
      <Footer />
      <JsonLd schema={masterskajaPageSchema()} />
    </>
  );
}

