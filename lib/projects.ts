import { fetchAllProjects, fetchProjectBySlugWithRelations, ProjectContent, ProjectDetailRecord } from "./project-repository";
import type { ProjectDetail } from "@/types/project";

type ProjectSummary = {
  id: number;
  slug: string;
  title: string;
  tagline?: string;
  heroImageUrl?: string;
  order: number;
  categories: string[];
  createdAt: string;
};

type CacheEntry<T> = { value: T; expires: number };
const CACHE_TTL_MS = 60_000;

let allProjectsCache: CacheEntry<ProjectSummary[]> | null = null;
const projectDetailCache = new Map<string, CacheEntry<ProjectDetail | null>>();

function readCache<T>(entry: CacheEntry<T> | null | undefined): T | null {
  if (!entry) {
    return null;
  }
  if (entry.expires > Date.now()) {
    return entry.value;
  }
  return null;
}

function writeCache<T>(store: Map<string, CacheEntry<T>>, key: string, value: T) {
  store.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
}

function writeAllProjectsCache(value: ProjectSummary[]) {
  allProjectsCache = { value, expires: Date.now() + CACHE_TTL_MS };
}

function normaliseCategories(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function normaliseContent(content: ProjectContent): {
  body: string[];
  facts: { label: string; value: string }[];
  seo?: {
    title?: string;
    description?: string;
    keywords?: string[];
    ogImage?: string | null;
  };
} {
  if (!content) {
    return { body: [], facts: [] };
  }
  const body = Array.isArray(content.body)
    ? content.body.filter((item): item is string => typeof item === "string")
    : [];
  const facts = Array.isArray(content.facts)
    ? content.facts.filter((item): item is { label: string; value: string } =>
        !!item && typeof item.label === "string" && typeof item.value === "string",
      )
    : [];
  const seoRaw = content.seo;
  const seo =
    seoRaw && typeof seoRaw === "object"
      ? {
          title: typeof seoRaw.title === "string" ? seoRaw.title : undefined,
          description: typeof seoRaw.description === "string" ? seoRaw.description : undefined,
          keywords: Array.isArray(seoRaw.keywords)
            ? seoRaw.keywords.filter(
                (item): item is string => typeof item === "string" && item.trim().length > 0,
              )
            : undefined,
          ogImage: typeof seoRaw.ogImage === "string" ? seoRaw.ogImage : undefined,
        }
      : undefined;
  return { body, facts, seo };
}

export async function getAllProjects() {
  const cached = readCache(allProjectsCache);
  if (cached) {
    return cached;
  }

  const projects = await fetchAllProjects();

  const summaries = projects.map<ProjectSummary>((project) => ({
    id: project.id,
    slug: project.slug,
    title: project.title,
    tagline: project.tagline ?? undefined,
    heroImageUrl: project.heroImageUrl ?? undefined,
    order: project.order,
    categories: normaliseCategories(project.categories),
    createdAt: project.createdAt?.toISOString?.() ?? new Date().toISOString(),
  }));

  writeAllProjectsCache(summaries);

  return summaries;
}

export async function getProjectBySlug(slug: string): Promise<ProjectDetail | null> {
  const cached = readCache(projectDetailCache.get(slug));
  if (cached !== null) {
    return cached;
  }

  const project = await fetchProjectBySlugWithRelations(slug);

  if (!project) {
    writeCache(projectDetailCache, slug, null);
    return null;
  }

  const categories = normaliseCategories(project.categories);
  const content = normaliseContent(project.content);

  let descriptionBody = content.body;
  if ((!descriptionBody || descriptionBody.length === 0) && project.content?.bodyHtml) {
    descriptionBody = project.content.bodyHtml
      .split(/\n|<\/p>/i)
      .map((entry) => entry.replace(/<[^>]+>/g, "").trim())
      .filter(Boolean);
  }

  const featureMedia = project.media.find((item) => item.kind === "FEATURE");
  const gallery = mapGallery(project.media);
  const schemes = project.schemes
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((scheme) => ({
      id: scheme.id,
      title: scheme.title,
      url: scheme.url,
      order: scheme.order,
    }));

  const detail: ProjectDetail = {
    id: project.id,
    slug: project.slug,
    title: project.title,
    heroImageUrl: project.heroImageUrl ?? featureMedia?.url,
    descriptionBody,
    descriptionHtml: project.content?.bodyHtml ?? null,
    facts: content.facts,
    categories,
    gallery,
    schemes,
    seo: content.seo,
  };

  writeCache(projectDetailCache, slug, detail);

  return detail;
}

function mapGallery(media: ProjectDetailRecord["media"]): Array<{ id: number; url: string; caption?: string; order: number }> {
  return media
    .filter((item) => item.kind === "GALLERY")
    .map((item) => ({
      id: item.id,
      url: item.url,
      caption: item.caption ?? undefined,
      order: item.order,
    }))
    .sort((a, b) => a.order - b.order);
}

export function invalidateProjectCache(slug?: string) {
  if (!slug) {
    projectDetailCache.clear();
    return;
  }
  projectDetailCache.delete(slug);
}

export function invalidateAllProjectsCache() {
  allProjectsCache = null;
}

