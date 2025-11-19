import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/admin-auth";
import { fetchAllPageSeo, upsertPageSeo } from "@/lib/page-seo-repository";
import { STATIC_SEO_PAGES, getStaticSeoPage } from "@/lib/seo/static-pages";
import { fetchAllProjectsWithRelations } from "@/lib/project-repository";

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

  // Ensure static pages exist
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

  // Add project pages - sync existing project SEO data to PageSeo if not exists
  const projects = await fetchAllProjectsWithRelations();
  for (const project of projects) {
    const projectSlug = project.slug;
    if (!pageMap.has(projectSlug)) {
      // If no PageSeo record exists, create one from project content SEO
      const projectSeo = project.content?.seo;
      const record = await upsertPageSeo({
        slug: projectSlug,
        title: projectSeo?.title ?? null,
        description: projectSeo?.description ?? null,
        keywords: Array.isArray(projectSeo?.keywords) ? projectSeo.keywords : [],
        ogImageUrl: projectSeo?.ogImage ?? null,
      });
      pageMap.set(projectSlug, record);
    }
  }

  // Serialize static pages
  const staticPages = STATIC_SEO_PAGES.map((definition) => serialisePage(definition, pageMap.get(definition.slug)));

  // Serialize project pages
  const projectPages = projects.map((project) => {
    const record = pageMap.get(project.slug);
    const projectSeo = project.content?.seo;
    // Use PageSeo record if exists, otherwise fall back to project content SEO
    return {
      slug: project.slug,
      label: project.title,
      path: `/${project.slug}`,
      defaults: {
        title: projectSeo?.title ?? `${project.title} — RINART`,
        description: projectSeo?.description ?? null,
        keywords: Array.isArray(projectSeo?.keywords) ? projectSeo.keywords : [],
        ogImageUrl: projectSeo?.ogImage ?? null,
      },
      seo: {
        // PageSeo record takes priority, fall back to project content SEO if no record exists
        title: record?.title ?? projectSeo?.title ?? null,
        description: record?.description ?? projectSeo?.description ?? null,
        keywords: record?.keywords.length > 0 ? record.keywords : (Array.isArray(projectSeo?.keywords) ? projectSeo.keywords : []),
        ogImageUrl: record?.ogImageUrl ?? projectSeo?.ogImage ?? null,
      },
    };
  });

  const pages = [...staticPages, ...projectPages];

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
  const isProject = !definition;

  if (isProject) {
    // For projects, update via project API
    const projects = await fetchAllProjectsWithRelations();
    const project = projects.find((p) => p.slug === slug);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
  } else if (!definition) {
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

  if (isProject) {
    // Update project SEO in project content
    const { updateProjectBySlug } = await import("@/lib/project-repository");
    const { buildContent, buildSeoPayload } = await import("@/lib/project-admin-utils");
    const projects = await fetchAllProjectsWithRelations();
    const project = projects.find((p) => p.slug === slug);
    if (project) {
      const existingContent = project.content;
      const seo = buildSeoPayload({
        title,
        description,
        keywords,
        ogImage: ogImageUrl,
      });
      const updatedContent = buildContent(
        existingContent?.body ?? [],
        existingContent?.facts ?? [],
        seo,
        existingContent?.bodyHtml ?? "",
      );
      await updateProjectBySlug(slug, { content: updatedContent });
      // Invalidate project cache to reflect SEO changes
      const { invalidateProjectCache } = await import("@/lib/projects");
      invalidateProjectCache(slug);
    }
    revalidatePath(`/${slug}`);
  } else if (definition) {
    revalidatePath(definition.path);
  }

  // Return serialized page
  if (isProject) {
    const projects = await fetchAllProjectsWithRelations();
    const project = projects.find((p) => p.slug === slug);
    if (project) {
      const projectSeo = project.content?.seo;
      return NextResponse.json({
        page: {
          slug: project.slug,
          label: project.title,
          path: `/${project.slug}`,
          defaults: {
            title: projectSeo?.title ?? `${project.title} — RINART`,
            description: projectSeo?.description ?? null,
            keywords: Array.isArray(projectSeo?.keywords) ? projectSeo.keywords : [],
            ogImageUrl: projectSeo?.ogImage ?? null,
          },
          seo: {
            // Return saved record data from PageSeo
            title: record.title,
            description: record.description,
            keywords: record.keywords,
            ogImageUrl: record.ogImageUrl,
          },
        },
      });
    }
  }

  return NextResponse.json({ page: serialisePage(definition!, record) });
}


