import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-auth";
import { getGlobalBlocks } from "@/lib/global-blocks";

export async function GET(request: NextRequest) {
  await assertAdmin(request);
  const blocks = await getGlobalBlocks();

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
  ];

  return NextResponse.json({ items });
}

