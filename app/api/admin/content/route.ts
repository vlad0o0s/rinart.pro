import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-auth";
import { getGlobalBlocks } from "@/lib/global-blocks";

export async function GET(request: NextRequest) {
  await assertAdmin(request);
  const blocks = await getGlobalBlocks();

  const { getContactSettings } = await import("@/lib/site-settings");
  const contact = await getContactSettings();

  const items = [
    {
      slug: "home-hero",
      title: "Главная фотография",
      imageUrl: blocks["home-hero"]?.imageUrl ?? null,
    },
    {
      slug: "page-transition",
      title: "Логотип загрузки/перехода",
      imageUrl: blocks["page-transition"]?.imageUrl ?? null,
    },
    {
      slug: "contacts",
      title: "Контакты",
      imageUrl: contact.heroImageUrl ?? null,
      locationLabel: contact.locationLabel ?? null,
    },
  ];

  return NextResponse.json({ items });
}

