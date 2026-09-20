import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { getAllProjects, getProjectBySlug } from "@/lib/projects";
import styles from "./page.module.css";
import { JsonLd } from "@/components/json-ld";
import { projectPageSchema, SITE_URL } from "@/lib/seo/schema";
import { filledOrUndefined, metaDescriptionFrom } from "@/lib/seo/text";
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
  // Пустое поле в карточке проекта считается незаданным. Запасное описание — первый
  // непустой абзац без разметки и сущностей, обрезанный по слову: раньше в сниппет
  // уходил сырой абзац с &nbsp; целиком.
  const title = filledOrUndefined(seo.title);
  const description = filledOrUndefined(seo.description) ?? metaDescriptionFrom(project.descriptionBody);
  const canonical = `${SITE_URL}/${project.slug}`;

  // Если картинка для соцсетей не задана вручную, берём главное изображение проекта:
  // раньше og:image просто отсутствовал и ссылка в мессенджерах выглядела пустой.
  const ogImageSource = seo.ogImage ?? project.heroImageUrl ?? null;
  const ogImage = ogImageSource
    ? ogImageSource.startsWith("http")
      ? ogImageSource
      : `${SITE_URL}${ogImageSource.startsWith("/") ? "" : "/"}${ogImageSource}`
    : null;

  return {
    title: title ?? `${project.title} — RINART`,
    description,
    keywords: seo.keywords,
    alternates: { canonical },
    openGraph: {
      title: title ?? project.title,
      description,
      url: canonical,
      siteName: "RINART",
      locale: "ru_RU",
      type: "article",
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: ogImage
      ? {
          card: "summary_large_image",
          title: title ?? project.title,
          description,
          images: [ogImage],
        }
      : undefined,
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
  const relatedProjects = allProjects.filter((item) => item.slug !== slug);

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
