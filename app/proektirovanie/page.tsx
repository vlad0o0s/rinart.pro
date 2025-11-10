import type { Metadata } from "next";
import { SiteHeader, PROEKTIR_SUBLINKS } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { HeroSection } from "./hero-section";
import { IntroSection } from "./intro-section";
import { WorkTypesSection } from "./work-types-section";

export const metadata: Metadata = {
  title: "Проектирование — RINART",
  description:
    "Проектирование частных домов и сопровождающих объектов. Скоро на этой странице появится подробная информация о процессах и стоимости.",
};

export default function ProektirovaniePage() {
  return (
    <>
      <SiteHeader
        showDesktopNav
        showBrand={false}
        subLinks={PROEKTIR_SUBLINKS}
      />
      <main className="min-h-screen bg-white text-neutral-900 antialiased">
        <HeroSection />
        <IntroSection />
        <WorkTypesSection />
        <Footer />
      </main>
    </>
  );
}

