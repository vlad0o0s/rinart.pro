import type { MetadataRoute } from "next";
import { fetchAllProjects } from "@/lib/project-repository";
import { SITE_URL } from "@/lib/seo/schema";

// Список проектов читается из базы на каждый запрос. Прежний revalidate рядом с
// force-dynamic не действовал и только путал.
export const dynamic = "force-dynamic";

function latest(dates: Date[]): Date | undefined {
  const times = dates.map((date) => date.getTime()).filter(Number.isFinite);
  return times.length ? new Date(Math.max(...times)) : undefined;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const projects = await fetchAllProjects();

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

  return [...baseRoutes, ...projectRoutes];
}
