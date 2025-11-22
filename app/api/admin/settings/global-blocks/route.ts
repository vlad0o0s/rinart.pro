import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-auth";
import { getGlobalBlocks, saveGlobalBlock, type GlobalBlocks } from "@/lib/global-blocks";
import { revalidatePath } from "next/cache";

export async function GET(request: NextRequest) {
  await assertAdmin(request);
  const blocks = await getGlobalBlocks();
  const response = NextResponse.json({ blocks });
  response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

export async function PUT(request: NextRequest) {
  await assertAdmin(request);
  const body = await request.json().catch(() => ({}));
  const blocks = (body?.blocks ?? {}) as Partial<GlobalBlocks>;
  try {
    const entries = Object.entries(blocks) as Array<[keyof GlobalBlocks, GlobalBlocks[keyof GlobalBlocks]]>;
    for (const [slug, data] of entries) {
      try {
        await saveGlobalBlock(slug, data);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка";
        // If file doesn't exist, clear the invalid path
        if (errorMessage.includes("Файл не найден") && slug !== "pricing") {
          const imageData = data as { imageUrl: string | null };
          if (imageData?.imageUrl) {
            // Clear the invalid path
            await saveGlobalBlock(slug, { imageUrl: null } as GlobalBlocks[typeof slug]);
          }
        }
        throw error;
      }
    }
    const saved = await getGlobalBlocks();
    revalidatePath("/");
    revalidatePath("/proektirovanie");
    const response = NextResponse.json({ blocks: saved });
    response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка";
    console.error("[Admin][API] Failed to save global blocks", error);
    return NextResponse.json({ 
      error: errorMessage.includes("Файл не найден") 
        ? errorMessage 
        : "Не удалось сохранить глобальные блоки" 
    }, { status: 500 });
  }
}


