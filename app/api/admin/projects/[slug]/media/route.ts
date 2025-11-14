import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/admin-auth";
import { replaceProjectMedia } from "@/lib/project-repository";
import { normaliseNullable } from "@/lib/project-admin-utils";

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  await assertAdmin(request);

  const { slug } = await context.params;
  const body = await request.json();
  const { featureImageUrl, gallery = [], schemes = [] } = body ?? {};
  const hasFeatureField = Object.prototype.hasOwnProperty.call(body ?? {}, "featureImageUrl");

  const galleryItems = Array.isArray(gallery)
    ? gallery
        .filter((item): item is { url: string; caption?: string | null; order?: number } => !!item && typeof item.url === "string")
        .map((item) => ({
          url: item.url,
          caption: typeof item.caption === "string" ? item.caption : null,
          order: typeof item.order === "number" ? item.order : undefined,
        }))
    : [];

  const schemeItems = Array.isArray(schemes)
    ? schemes
        .filter((item): item is { url: string; title?: string | null; order?: number } => !!item && typeof item.url === "string")
        .map((item) => ({
          url: item.url,
          title: typeof item.title === "string" ? item.title : undefined,
          order: typeof item.order === "number" ? item.order : undefined,
        }))
    : [];

  try {
    await replaceProjectMedia({
      projectSlug: slug,
      featureImageUrl: hasFeatureField ? normaliseNullable(featureImageUrl) : undefined,
      gallery: galleryItems,
      schemes: schemeItems,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Project not found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw error;
  }

  revalidatePath("/");
  revalidatePath(`/${slug}`);

  return NextResponse.json({ success: true });
}
