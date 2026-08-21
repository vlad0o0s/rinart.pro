import type { MetadataRoute } from "next";
import { fetchAllProjects } from "@/lib/project-repository";

const SITE_URL = "https://rinart.pro";

export const revalidate = 3600;
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // У постоянных страниц раньше не было ни даты изменения, ни приоритета —
  // робот не понимал, какие разделы важнее и когда их перечитывать.
  const now = new Date();
  const baseRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/proektirovanie`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/masterskaja`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/kontakty`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];

  const projects = await fetchAllProjects();
  const projectRoutes: MetadataRoute.Sitemap = projects.map((project) => {
    const lastModified = project.updatedAt ?? project.createdAt ?? new Date();
    return {
      url: `${SITE_URL}/${project.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    };
  });

  return [...baseRoutes, ...projectRoutes];
}

