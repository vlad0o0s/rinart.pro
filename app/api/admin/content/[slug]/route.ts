import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-auth";
import { saveGlobalBlock, type GlobalBlocks } from "@/lib/global-blocks";
import { getContactSettings, saveContactSettings } from "@/lib/site-settings";

type AllowedSlug = keyof GlobalBlocks;
type AllowedContentSlug = AllowedSlug | "contacts";

function isAllowedSlug(slug: string): slug is AllowedContentSlug {
  return slug === "home-hero" || slug === "page-transition" || slug === "contacts";
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

  const payload = (await request.json().catch(() => ({}))) as { imageUrl?: string | null; locationLabel?: string | null };

  if (slug === "contacts") {
    // Сохраняем настройки контактов
    const current = await getContactSettings();
    const updated = await saveContactSettings({
      ...current,
      heroImageUrl: typeof payload.imageUrl === "string" ? payload.imageUrl : payload.imageUrl === null ? null : current.heroImageUrl,
      locationLabel: typeof payload.locationLabel === "string" ? payload.locationLabel : payload.locationLabel === null ? "" : current.locationLabel,
    });

    return NextResponse.json({
      item: {
        slug: "contacts",
        title: "Контакты",
        imageUrl: updated.heroImageUrl ?? null,
        locationLabel: updated.locationLabel ?? null,
      },
    });
  }

  // Обработка других slug (home-hero, page-transition)
  if (slug !== "home-hero" && slug !== "page-transition") {
    return NextResponse.json({ error: "Invalid slug for global blocks" }, { status: 400 });
  }
  const next = { imageUrl: typeof payload.imageUrl === "string" ? payload.imageUrl : null };
  const saved = await saveGlobalBlock(slug, next);

  return NextResponse.json({
    item: {
      slug,
      title: slug === "home-hero" ? "Главная фотография" : "Логотип загрузки/перехода",
      imageUrl: saved.imageUrl ?? null,
    },
  });
}

