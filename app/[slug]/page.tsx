import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { getAllProjects, getProjectBySlug } from "@/lib/projects";
import styles from "./page.module.css";
import { JsonLd } from "@/components/json-ld";
import { projectPageSchema } from "@/lib/seo/schema";
import ProjectBody from "./project-body";
import { RouteReadyAnnouncer } from "@/components/route-ready-announcer";
import { RelatedProjectsSlider } from "./related-projects";
import { getSocialLinks } from "@/lib/site-settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);

  if (!project) {
    return {
      title: "Проект не найден — RINART",
    };
  }

  const seo = project.seo ?? {};
  const firstParagraph = project.descriptionBody?.[0];
  const description = seo.description ?? firstParagraph ?? undefined;
  const ogImages = seo.ogImage ? [seo.ogImage] : [];

  return {
    title: seo.title ?? `${project.title} — RINART`,
    description,
    keywords: seo.keywords,
    openGraph: {
      title: seo.title ?? project.title,
      description,
      images: ogImages.length ? ogImages : undefined,
    },
  };
}

async function ProjectPageComponent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [project, allProjects, socialLinks] = await Promise.all([
    getProjectBySlug(slug),
    getAllProjects(),
    getSocialLinks(),
  ]);

  if (!project) {
    notFound();
  }

  const { title, heroImageUrl, descriptionBody, descriptionHtml, schemes, gallery } = project;
  const relatedProjects = allProjects
    .filter((item) => item.slug !== slug)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  const descriptionParagraphs = descriptionBody.filter(
    (paragraph): paragraph is string => typeof paragraph === "string" && paragraph.trim().length > 0,
  );

  return (
    <>
      <SiteHeader showDesktopNav breadcrumbLabel="Портфолио" socialLinks={socialLinks} />
      <div className={styles.page}>
        <ProjectBody
          title={title}
          descriptionHtml={descriptionHtml}
          descriptionParagraphs={descriptionParagraphs}
          featureImage={heroImageUrl}
          schemes={schemes.map((scheme) => ({ title: scheme.title, image: scheme.url }))}
          gallery={gallery.map((item) => item.url)}
        />
        <RelatedProjectsSlider projects={relatedProjects} />
      </div>
      <Footer />
      <JsonLd schema={projectPageSchema(project)} />
      <RouteReadyAnnouncer />
    </>
  );
}

export default ProjectPageComponent;
