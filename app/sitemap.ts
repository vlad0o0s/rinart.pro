import type { MetadataRoute } from "next";
import { fetchAllProjects } from "@/lib/project-repository";

const SITE_URL = "https://rinart.pro";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL },
    { url: `${SITE_URL}/proektirovanie` },
    { url: `${SITE_URL}/masterskaja` },
    { url: `${SITE_URL}/kontakty` },
  ];

  const projects = await fetchAllProjects();
  const projectRoutes: MetadataRoute.Sitemap = projects.map((project) => {
    const lastModified = project.updatedAt ?? project.createdAt ?? new Date();
    return {
      url: `${SITE_URL}/${project.slug}`,
      lastModified,
    };
  });

  return [...baseRoutes, ...projectRoutes];
}

