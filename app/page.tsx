import type { Metadata } from "next";
import ReactDOM from "react-dom";
import { SiteHeader } from "@/components/site-header";
import { Hero } from "@/components/hero";
import { buildResponsiveSrcSet } from "@/lib/image-srcset";
import { PrimaryNav } from "@/components/primary-nav";
import { Footer } from "@/components/footer";
import { HomeProjectsSection } from "./_components/home-page-content";
import styles from "./page.module.css";
import { getAllProjects } from "@/lib/projects";
import { getSocialLinks } from "@/lib/site-settings";
import { JsonLd } from "@/components/json-ld";
import { homePageSchema } from "@/lib/seo/schema";
import { buildPageMetadata } from "@/lib/page-seo";
import { RouteReadyAnnouncer } from "@/components/route-ready-announcer";
import { getGlobalBlocks } from "@/lib/global-blocks";
import { getMainNavLinks } from "@/lib/navigation";

export const dynamic = "force-dynamic";
export const dynamicParams = true;
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata("home");
}

export default async function Home() {
  const [projects, socialLinks, blocks, navLinks] = await Promise.all([
    getAllProjects(),
    getSocialLinks(),
    getGlobalBlocks(),
    getMainNavLinks(),
  ]);
  const summaries = (projects as Array<{
    slug: string;
    title: string;
    tagline?: string;
    heroImageUrl?: string;
    categories: string[];
  }>).map((project) => ({
    slug: project.slug,
    title: project.title,
    tagline: project.tagline ?? undefined,
    heroImageUrl: project.heroImageUrl ?? undefined,
    categories: project.categories,
  }));

  // Первый экран — самый крупный элемент страницы и её LCP. Мы рендерим его нативным <img>
  // (в обход next/image), поэтому автоматической предзагрузки нет: браузер узнавал о картинке
  // только после разбора HTML и CSS. Объявляем её заранее.
  const heroImageUrl = blocks["home-hero"]?.imageUrl ?? "/img/01-ilichevka.jpg";
  ReactDOM.preload(heroImageUrl, {
    as: "image",
    imageSrcSet: buildResponsiveSrcSet(heroImageUrl),
    imageSizes: "100vw",
    fetchPriority: "high",
  });

  return (
    <>
      <SiteHeader showDesktopBrand socialLinks={socialLinks} navLinks={navLinks} />
      <main className={`${styles.pageShell} min-h-screen bg-white text-neutral-900 antialiased`}>
        <div className={styles.stage}>
          <div className={styles.stageLayer} data-stage="hero">
        <Hero imageUrl={blocks["home-hero"]?.imageUrl ?? undefined} />
          </div>
          <div className={styles.stageLayer} data-stage="nav">
          <PrimaryNav links={navLinks} />
          </div>
          <div className={styles.stageLayer} data-stage="portfolio">
            <HomeProjectsSection projects={summaries} />
          </div>
          <div className={styles.stageLayer} data-stage="footer">
            <Footer />
          </div>
        </div>
      </main>
      <JsonLd
        schema={homePageSchema(
          summaries.map((project) => ({
            title: project.title,
            slug: project.slug,
          })),
        )}
      />
      <RouteReadyAnnouncer />
    </>
  );
}
