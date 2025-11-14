import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/admin-auth";
import { createProject, fetchAllProjectsWithRelations, fetchProjectIdBySlug } from "@/lib/project-repository";
import { fetchMediaAssets } from "@/lib/media-library-repository";
import { buildContent, buildSeoPayload, ensureFacts, ensureStringArray, normaliseNullable } from "@/lib/project-admin-utils";
import { invalidateAllProjectsCache, invalidateProjectCache } from "@/lib/projects";

export async function GET(request: NextRequest) {
  await assertAdmin(request);

  const projects = await fetchAllProjectsWithRelations();
  const mediaLibrary = await fetchMediaAssets();

  return NextResponse.json({ projects, mediaLibrary });
}

export async function POST(request: NextRequest) {
  await assertAdmin(request);

  const body = await request.json();
  const {
    slug,
    title,
    order = 0,
    tagline = null,
    location = null,
    year = null,
    area = null,
    scope = null,
    intro = null,
  } = body ?? {};

  if (!slug || !title) {
    return NextResponse.json({ error: "Slug and title are required" }, { status: 400 });
  }

  const existingId = await fetchProjectIdBySlug(slug);
  if (existingId) {
    return NextResponse.json({ error: "Project with this slug already exists" }, { status: 409 });
  }

  const categories = ensureStringArray(body?.categories);
  const descriptionBody = ensureStringArray(body?.descriptionBody);
  const descriptionHtml = typeof body?.descriptionHtml === "string" ? body.descriptionHtml : "";
  const facts = ensureFacts(body?.facts);
  const seoKeywords = ensureStringArray(body?.seoKeywords);
  const seo = buildSeoPayload({
    title: normaliseNullable(body?.seoTitle),
    description: normaliseNullable(body?.seoDescription),
    keywords: seoKeywords,
    ogImage: normaliseNullable(body?.seoOgImage),
  });

  const project = await createProject({
    slug,
    title,
    order: Number(order) || 0,
    tagline: normaliseNullable(tagline),
    location: normaliseNullable(location),
    year: normaliseNullable(year),
    area: normaliseNullable(area),
    scope: normaliseNullable(scope),
    intro: normaliseNullable(intro),
    heroImageUrl: normaliseNullable(body?.heroImageUrl ?? null),
    categories,
    content: buildContent(descriptionBody, facts, seo, descriptionHtml),
  });

  revalidatePath("/");
  revalidatePath(`/${slug}`);

  invalidateAllProjectsCache();
  invalidateProjectCache(slug);

  return NextResponse.json({ project }, { status: 201 });
}
