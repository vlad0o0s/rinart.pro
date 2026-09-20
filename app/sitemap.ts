import type { MetadataRoute } from "next";
import { getPublishedArticles } from "@/lib/article-repository";
import { ARTICLES_PATH, articleModifiedAt, type Article } from "@/lib/articles";
import { fetchAllProjects } from "@/lib/project-repository";
import { SITE_URL } from "@/lib/seo/schema";

/** Сбой чтения статей не должен лишать робота всей карты сайта. */
async function safePublishedArticles(): Promise<Article[]> {
  try {
    return await getPublishedArticles();
  } catch (error) {
    console.error("[sitemap] failed to read articles", error);
    return [];
  }
}

// Список проектов читается из базы на каждый запрос. Прежний revalidate рядом с
// force-dynamic не действовал и только путал.
export const dynamic = "force-dynamic";

function latest(dates: Date[]): Date | undefined {
  const times = dates.map((date) => date.getTime()).filter(Number.isFinite);
  return times.length ? new Date(Math.max(...times)) : undefined;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [projects, articles] = await Promise.all([fetchAllProjects(), safePublishedArticles()]);

  // Черновики сюда не попадают: getPublishedArticles отдаёт только опубликованные.
  const articleRoutes: MetadataRoute.Sitemap = articles.length
    ? [
        {
          url: `${SITE_URL}${ARTICLES_PATH}`,
          lastModified: latest(articles.map((article) => new Date(articleModifiedAt(article) ?? article.updatedAt))),
          changeFrequency: "weekly",
          priority: 0.7,
        },
        ...articles.map((article) => {
          const modified = articleModifiedAt(article);
          return {
            url: `${SITE_URL}${ARTICLES_PATH}/${article.slug}`,
            lastModified: modified ? new Date(modified) : undefined,
            changeFrequency: "monthly" as const,
            priority: 0.6,
          };
        }),
      ]
    : [];

  const projectRoutes: MetadataRoute.Sitemap = projects.map((project) => ({
    url: `${SITE_URL}/${project.slug}`,
    lastModified: project.updatedAt ?? project.createdAt,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  // Раньше у постоянных страниц стояла текущая дата: каждый запрос sitemap сообщал роботу,
  // что все разделы только что изменились. Настоящей даты правки их текстов нет, поэтому
  // дата не указывается вовсе. Главная — это портфолио: её дата — последняя правка проектов.
  const baseRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: latest(projects.map((project) => project.updatedAt ?? project.createdAt)),
      changeFrequency: "weekly",
      priority: 1,
    },
    { url: `${SITE_URL}/proektirovanie`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/masterskaja`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/kontakty`, changeFrequency: "monthly", priority: 0.6 },
  ];

  return [...baseRoutes, ...articleRoutes, ...projectRoutes];
}
