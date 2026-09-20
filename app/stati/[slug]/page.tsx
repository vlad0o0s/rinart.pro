import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/footer";
import { JsonLd } from "@/components/json-ld";
import { LeadForm } from "@/components/lead-form";
import { RouteReadyAnnouncer } from "@/components/route-ready-announcer";
import { SiteHeader } from "@/components/site-header";
import { getAdminSessionFromCookies } from "@/lib/admin-auth";
import { fetchArticleBySlug, getPublishedArticleBySlug } from "@/lib/article-repository";
import { ARTICLES_LABEL, ARTICLES_PATH, articleModifiedAt, formatArticleDate, type Article } from "@/lib/articles";
import { getMainNavLinks } from "@/lib/navigation";
import { getAllProjects } from "@/lib/projects";
import { articleSchema, SITE_URL } from "@/lib/seo/schema";
import { metaDescriptionFrom } from "@/lib/seo/text";
import { SERVICE_PAGES } from "@/lib/services";
import { getSocialLinks } from "@/lib/site-settings";
import styles from "../stati.module.css";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

/**
 * Опубликованная статья видна всем. Черновик — только вошедшему в админку: с пометкой
 * и закрытый от индексации, чтобы бюро могло посмотреть статью до публикации.
 */
async function loadArticle(slug: string): Promise<{ article: Article | null; preview: boolean }> {
  const published = await getPublishedArticleBySlug(slug);
  if (published) {
    return { article: published, preview: false };
  }
  const session = await getAdminSessionFromCookies().catch(() => null);
  if (!session) {
    return { article: null, preview: false };
  }
  const draft = await fetchArticleBySlug(slug);
  return { article: draft, preview: Boolean(draft) };
}

function absolute(url: string | null): string | undefined {
  if (!url) return undefined;
  return url.startsWith("http") ? url : `${SITE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { article, preview } = await loadArticle(slug);
  if (!article) {
    return { title: "Статья не найдена — RINART" };
  }

  const canonical = `${SITE_URL}${ARTICLES_PATH}/${article.slug}`;
  const title = article.seoTitle || `${article.title} — RINART`;
  const description = article.seoDescription || article.excerpt || metaDescriptionFrom([article.bodyHtml]);
  const image = absolute(article.coverImageUrl);

  return {
    title,
    description,
    alternates: { canonical },
    robots: preview ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "article",
      title: article.seoTitle || article.title,
      description,
      url: canonical,
      siteName: "RINART",
      locale: "ru_RU",
      publishedTime: article.publishedAt ?? undefined,
      modifiedTime: articleModifiedAt(article) ?? undefined,
      authors: article.authorName ? [article.authorName] : undefined,
      images: image ? [{ url: image }] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const [{ article, preview }, socialLinks, navLinks, projects] = await Promise.all([
    loadArticle(slug),
    getSocialLinks(),
    getMainNavLinks(),
    getAllProjects(),
  ]);

  if (!article) {
    notFound();
  }

  const service = SERVICE_PAGES.find((item) => item.path === article.servicePath) ?? null;
  const relatedProjects = article.relatedProjects
    .map((projectSlug) => projects.find((project) => project.slug === projectSlug))
    .filter((project): project is (typeof projects)[number] => Boolean(project));
  const modifiedAt = articleModifiedAt(article);
  const showUpdated = Boolean(modifiedAt && article.publishedAt && modifiedAt !== article.publishedAt);

  return (
    <>
      <SiteHeader showDesktopNav socialLinks={socialLinks} navLinks={navLinks} breadcrumbLabel={ARTICLES_LABEL} />
      <main className={styles.page}>
        <article className={styles.article}>
          {preview ? (
            <p className={styles.previewBanner}>
              {article.status === "draft"
                ? "Черновик: эту страницу видите только вы. Опубликуйте статью в админке, чтобы она появилась на сайте."
                : "Статья опубликуется в назначенную дату; пока её видите только вы."}
            </p>
          ) : null}

          <nav className={styles.crumbs} aria-label="Навигация по разделу">
            <Link href="/">Главная</Link>
            <span aria-hidden="true"> / </span>
            <Link href={ARTICLES_PATH}>{ARTICLES_LABEL}</Link>
          </nav>

          <h1 className={styles.title}>{article.title}</h1>

          <p className={styles.meta}>
            {article.authorName ? (
              <span>
                {article.authorName}
                {article.authorRole ? `, ${article.authorRole}` : ""}
              </span>
            ) : null}
            {article.publishedAt ? (
              <time dateTime={article.publishedAt}>{formatArticleDate(article.publishedAt)}</time>
            ) : null}
            {showUpdated && modifiedAt ? (
              <span>
                обновлено <time dateTime={modifiedAt}>{formatArticleDate(modifiedAt)}</time>
              </span>
            ) : null}
          </p>

          {article.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={article.coverImageUrl} alt="" className={styles.cover} decoding="async" fetchPriority="high" />
          ) : null}

          {article.excerpt ? <p className={styles.lead}>{article.excerpt}</p> : null}

          <div className={styles.body} dangerouslySetInnerHTML={{ __html: article.bodyHtml }} />

          {service || relatedProjects.length ? (
            <aside className={styles.related} aria-label="По теме">
              <h2 className={styles.relatedTitle}>По теме</h2>
              {service ? (
                <Link href={service.path} className={styles.serviceLink}>
                  {service.label} →
                </Link>
              ) : null}
              {relatedProjects.length ? (
                <ul className={styles.relatedProjects}>
                  {relatedProjects.map((project) => (
                    <li key={project.slug}>
                      <Link href={`/${project.slug}`} className={styles.relatedProject}>
                        {project.heroImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={project.heroImageUrl} alt="" loading="lazy" decoding="async" />
                        ) : null}
                        <span>{project.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </aside>
          ) : null}
        </article>

        <div className={styles.leadForm}>
          <LeadForm
            source={`Статья: ${article.title}`}
            title="Обсудить свой дом"
            subtitle="Оставьте телефон — архитектор свяжется с вами, уточнит задачу и расскажет, как может начаться работа."
            placement="project"
          />
        </div>
      </main>
      <Footer />
      {preview ? null : <JsonLd schema={articleSchema(article)} />}
      <RouteReadyAnnouncer />
    </>
  );
}
