import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/admin-auth";
import { fetchAllPageSeo, upsertPageSeo } from "@/lib/page-seo-repository";
import { STATIC_SEO_PAGES, getStaticSeoPage } from "@/lib/seo/static-pages";

function serialisePage(definition: (typeof STATIC_SEO_PAGES)[number], record?: Awaited<ReturnType<typeof fetchAllPageSeo>>[number]) {
  return {
    slug: definition.slug,
    label: definition.label,
    path: definition.path,
    defaults: definition.defaults,
    seo: {
      title: record?.title ?? null,
      description: record?.description ?? null,
      keywords: record?.keywords ?? [],
      ogImageUrl: record?.ogImageUrl ?? null,
    },
  };
}

function normaliseKeywords(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((keyword) => (typeof keyword === "string" ? keyword.trim() : ""))
      .filter((keyword) => keyword.length > 0);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword.length > 0);
  }
  return [];
}

export async function GET(request: NextRequest) {
  await assertAdmin(request);

  const records = await fetchAllPageSeo();
  const pageMap = new Map(records.map((record) => [record.slug, record]));

  for (const definition of STATIC_SEO_PAGES) {
    if (!pageMap.has(definition.slug)) {
      const defaults = definition.defaults ?? {};
      const record = await upsertPageSeo({
        slug: definition.slug,
        title: defaults.title ?? null,
        description: defaults.description ?? null,
        keywords: defaults.keywords ?? [],
        ogImageUrl: defaults.ogImageUrl ?? null,
      });
      pageMap.set(definition.slug, record);
    }
  }

  const pages = STATIC_SEO_PAGES.map((definition) => serialisePage(definition, pageMap.get(definition.slug)));

  return NextResponse.json({ pages });
}

export async function PUT(request: NextRequest) {
  await assertAdmin(request);

  const body = await request.json();
  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
  if (!slug) {
    return NextResponse.json({ error: "Slug is required" }, { status: 400 });
  }

  const definition = getStaticSeoPage(slug);
  if (!definition) {
    return NextResponse.json({ error: "Unknown page" }, { status: 404 });
  }

  const title = typeof body?.title === "string" ? body.title.trim() : null;
  const description = typeof body?.description === "string" ? body.description.trim() : null;
  const keywords = normaliseKeywords(body?.keywords);
  const ogImageRaw = typeof body?.ogImageUrl === "string" ? body.ogImageUrl.trim() : "";
  const ogImageUrl = ogImageRaw.length ? ogImageRaw : null;

  const record = await upsertPageSeo({
    slug,
    title,
    description,
    keywords,
    ogImageUrl,
  });

  revalidatePath(definition.path);

  return NextResponse.json({ page: serialisePage(definition, record) });
}


