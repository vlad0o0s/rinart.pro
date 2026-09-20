import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { getAllProjects, getProjectBySlug } from "@/lib/projects";
import styles from "./page.module.css";
import { JsonLd } from "@/components/json-ld";
import { projectPageSchema, SITE_URL } from "@/lib/seo/schema";
import { filledOrUndefined, metaDescriptionFrom } from "@/lib/seo/text";
import { PROJECT_DESCRIPTION_SIZES, prepareRichHtml } from "@/lib/rich-html";
import ProjectBody from "./project-body";
import { RouteReadyAnnouncer } from "@/components/route-ready-announcer";
import { RelatedProjectsSlider } from "./related-projects";
import { getSocialLinks } from "@/lib/site-settings";
import { getMainNavLinks } from "@/lib/navigation";

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
  const [project, allProjects, socialLinks, navLinks] = await Promise.all([
    getProjectBySlug(slug),
    getAllProjects(),
    getSocialLinks(),
    getMainNavLinks(),
  ]);

  if (!project) {
    notFound();
  }

  const { title, heroImageUrl, descriptionBody, descriptionHtml, schemes, gallery } = project;
  const relatedProjects = allProjects.filter((item) => item.slug !== slug);

  const descriptionParagraphs = descriptionBody.filter(
    (paragraph): paragraph is string => typeof paragraph === "string" && paragraph.trim().length > 0,
  );

  // Готовим сохранённый в базе HTML: убираем следы редактора и даём картинкам srcset.
  const descriptionForPage = descriptionHtml
    ? prepareRichHtml(descriptionHtml, { sizes: PROJECT_DESCRIPTION_SIZES })
    : descriptionHtml;

  return (
    <>
      <SiteHeader showDesktopNav breadcrumbLabel="Портфолио" socialLinks={socialLinks} navLinks={navLinks} />
      <div className={styles.page}>
        <ProjectBody
          title={title}
          descriptionHtml={descriptionForPage}
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
