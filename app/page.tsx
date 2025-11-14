import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { Hero } from "@/components/hero";
import { PrimaryNav } from "@/components/primary-nav";
import { Footer } from "@/components/footer";
import { HomeProjectsSection } from "./_components/home-page-content";
import styles from "./page.module.css";
import { getAllProjects } from "@/lib/projects";
import { JsonLd } from "@/components/json-ld";
import { homePageSchema } from "@/lib/seo/schema";
import { buildPageMetadata } from "@/lib/page-seo";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata("home");
}

export default async function Home() {
  const projects = await getAllProjects();
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

  return (
    <>
      <SiteHeader showDesktopNav={false} />
      <main className={`${styles.pageShell} min-h-screen bg-white text-neutral-900 antialiased`}>
        <div className={styles.stage}>
          <div className={styles.stageLayer} data-stage="hero">
        <Hero />
          </div>
          <div className={`${styles.stageLayer} hidden md:block`} data-stage="nav">
          <PrimaryNav />
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
    </>
  );
}
