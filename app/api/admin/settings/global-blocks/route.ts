import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-auth";
import { getGlobalBlocks, saveGlobalBlock, type GlobalBlocks } from "@/lib/global-blocks";
import { revalidatePath } from "next/cache";

export async function GET(request: NextRequest) {
  await assertAdmin(request);
  const blocks = await getGlobalBlocks();
  return NextResponse.json({ blocks });
}

export async function PUT(request: NextRequest) {
  await assertAdmin(request);
  const body = await request.json().catch(() => ({}));
  const blocks = (body?.blocks ?? {}) as Partial<GlobalBlocks>;
  try {
    const entries = Object.entries(blocks) as Array<[keyof GlobalBlocks, GlobalBlocks[keyof GlobalBlocks]]>;
    for (const [slug, data] of entries) {
      await saveGlobalBlock(slug, data);
    }
    const saved = await getGlobalBlocks();
    revalidatePath("/");
    return NextResponse.json({ blocks: saved });
  } catch (error) {
    console.error("[Admin][API] Failed to save global blocks", error);
    return NextResponse.json({ error: "Не удалось сохранить глобальные блоки" }, { status: 500 });
  }
}


