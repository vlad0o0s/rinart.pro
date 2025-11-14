import type { Metadata } from "next";
import { findPageSeoBySlug } from "./page-seo-repository";
import { getStaticSeoPage } from "./seo/static-pages";

const SITE_URL = "https://rinart.pro";

export type ResolvedPageSeo = {
  slug: string;
  path: string;
  label: string;
  title: string;
  description: string;
  keywords: string[];
  ogImageUrl: string | null;
};

function toAbsoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${SITE_URL}${url.startsWith("/") ? url : `/${url}`}`;
}

export async function resolvePageSeo(slug: string): Promise<ResolvedPageSeo | null> {
  const definition = getStaticSeoPage(slug);
  if (!definition) {
    return null;
  }

  const override = await findPageSeoBySlug(slug);

  const title = override?.title ?? definition.defaults.title ?? "";
  const description = override?.description ?? definition.defaults.description ?? "";
  const keywords = override?.keywords?.length
    ? override.keywords
    : definition.defaults.keywords ?? [];
  const ogImageUrl = override?.ogImageUrl ?? definition.defaults.ogImageUrl ?? null;

  return {
    slug,
    path: definition.path,
    label: definition.label,
    title,
    description,
    keywords,
    ogImageUrl,
  };
}

export async function buildPageMetadata(slug: string): Promise<Metadata> {
  const seo = await resolvePageSeo(slug);
  if (!seo) {
    return {};
  }

  const canonical = `${SITE_URL}${seo.path === "/" ? "" : seo.path}`;
  const absoluteOgImage = toAbsoluteUrl(seo.ogImageUrl);

  return {
    title: seo.title || undefined,
    description: seo.description || undefined,
    keywords: seo.keywords.length ? seo.keywords : undefined,
    alternates: {
      canonical,
    },
    openGraph: {
      title: seo.title || undefined,
      description: seo.description || undefined,
      url: canonical,
      siteName: "RINART",
      images: absoluteOgImage ? [{ url: absoluteOgImage }] : undefined,
    },
    twitter: absoluteOgImage
      ? {
          card: "summary_large_image",
          title: seo.title || undefined,
          description: seo.description || undefined,
          images: [absoluteOgImage],
        }
      : undefined,
  };
}


