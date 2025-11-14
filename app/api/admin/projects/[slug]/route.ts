import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/admin-auth";
import {
  deleteProjectBySlug,
  fetchProjectBySlugWithRelations,
  fetchProjectIdBySlug,
  updateProjectBySlug,
} from "@/lib/project-repository";
import { buildContent, buildSeoPayload, ensureFacts, ensureStringArray, normaliseNullable } from "@/lib/project-admin-utils";
import { invalidateAllProjectsCache, invalidateProjectCache } from "@/lib/projects";

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  await assertAdmin(request);
  const { slug } = await context.params;
  const project = await fetchProjectBySlugWithRelations(slug);

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ project });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  await assertAdmin(request);
  const { slug } = await context.params;
  const body = await request.json();

  const existing = await fetchProjectBySlugWithRelations(slug);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: Parameters<typeof updateProjectBySlug>[1] = {};

  if ("title" in body) updates.title = typeof body.title === "string" ? body.title : existing.title;
  if ("slug" in body && typeof body.slug === "string" && body.slug !== slug) {
    const slugExists = await fetchProjectIdBySlug(body.slug);
    if (slugExists) {
      return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
    }
    updates.slug = body.slug;
  }
  if ("tagline" in body) updates.tagline = normaliseNullable(body.tagline);
  if ("location" in body) updates.location = normaliseNullable(body.location);
  if ("year" in body) updates.year = normaliseNullable(body.year);
  if ("area" in body) updates.area = normaliseNullable(body.area);
  if ("scope" in body) updates.scope = normaliseNullable(body.scope);
  if ("intro" in body) updates.intro = normaliseNullable(body.intro);
  if ("heroImageUrl" in body) updates.heroImageUrl = normaliseNullable(body.heroImageUrl);
  if ("order" in body) updates.order = Number(body.order) || 0;
  if ("categories" in body) updates.categories = ensureStringArray(body.categories);

  const shouldUpdateDescription = "descriptionBody" in body;
  const shouldUpdateFacts = "facts" in body;
  const shouldUpdateSeo =
    "seoTitle" in body || "seoDescription" in body || "seoKeywords" in body || "seoOgImage" in body;
  const shouldUpdateHtml = "descriptionHtml" in body;

  if (shouldUpdateDescription || shouldUpdateFacts || shouldUpdateSeo || shouldUpdateHtml) {
    const descriptionBody = shouldUpdateDescription
      ? ensureStringArray(body.descriptionBody)
      : ensureStringArray(existing.content?.body ?? []);
    const facts = shouldUpdateFacts ? ensureFacts(body.facts) : ensureFacts(existing.content?.facts ?? []);
    const existingSeo = existing.content?.seo;
    const seoTitle = "seoTitle" in body ? normaliseNullable(body.seoTitle) : existingSeo?.title ?? null;
    const seoDescription =
      "seoDescription" in body ? normaliseNullable(body.seoDescription) : existingSeo?.description ?? null;
    const seoKeywords =
      "seoKeywords" in body ? ensureStringArray(body.seoKeywords) : existingSeo?.keywords ?? [];
    const seoOgImage = "seoOgImage" in body ? normaliseNullable(body.seoOgImage) : existingSeo?.ogImage ?? null;
    const seo = buildSeoPayload({
      title: seoTitle,
      description: seoDescription,
      keywords: seoKeywords,
      ogImage: seoOgImage,
    });
    const descriptionHtml =
      shouldUpdateHtml && typeof body.descriptionHtml === "string"
        ? body.descriptionHtml
        : existing.content?.bodyHtml ?? "";

    updates.content = buildContent(descriptionBody, facts, seo, descriptionHtml);
  }

  const updated = await updateProjectBySlug(slug, updates);

  const newSlug = updates.slug ?? slug;

  revalidatePath("/");
  revalidatePath(`/${slug}`);
  if (newSlug !== slug) {
    revalidatePath(`/${newSlug}`);
  }

  invalidateProjectCache(slug);
  invalidateProjectCache(newSlug);
  invalidateAllProjectsCache();

  return NextResponse.json({ project: updated });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  await assertAdmin(request);
  const { slug } = await context.params;

  await deleteProjectBySlug(slug);

  revalidatePath("/");
  revalidatePath(`/${slug}`);

  invalidateProjectCache(slug);
  invalidateAllProjectsCache();

  return NextResponse.json({ success: true });
}
