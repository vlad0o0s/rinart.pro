import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-auth";
import { saveGlobalBlock, type GlobalBlocks } from "@/lib/global-blocks";

type AllowedSlug = keyof GlobalBlocks;

function isAllowedSlug(slug: string): slug is AllowedSlug {
  return slug === "home-hero" || slug === "page-transition";
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  await assertAdmin(request);
  const { slug: rawSlug } = await context.params;
  const slug = decodeURIComponent((rawSlug ?? "")).trim();
  if (!isAllowedSlug(slug)) {
    try {
      console.warn("[Admin-Content] Unknown content slug", { rawSlug, normalized: slug });
    } catch {}
    return NextResponse.json({ error: "Unknown content slug" }, { status: 400 });
  }

  const payload = (await request.json().catch(() => ({}))) as { imageUrl?: string | null };
  const next = { imageUrl: typeof payload.imageUrl === "string" ? payload.imageUrl : null };

  const saved = await saveGlobalBlock(slug, next as GlobalBlocks[AllowedSlug]);

  return NextResponse.json({
    item: {
      slug,
      title: slug === "home-hero" ? "Главная фотография" : "Логотип загрузки/перехода",
      imageUrl: saved.imageUrl ?? null,
    },
  });
}

