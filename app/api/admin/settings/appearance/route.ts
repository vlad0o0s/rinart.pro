import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-auth";
import { getGlobalBlocks } from "@/lib/global-blocks";
import { revalidatePath } from "next/cache";

export async function GET(request: NextRequest) {
  await assertAdmin(request);
  // Use global blocks instead of legacy appearance settings
  const blocks = await getGlobalBlocks();
  const appearance = {
    homeHeroImageUrl: blocks["home-hero"]?.imageUrl || "/img/01-ilichevka.jpg",
    transitionImageUrl: blocks["page-transition"]?.imageUrl || "https://cdn.prod.website-files.com/66bb7b4fa99c404bd3587d90/66bb7c2f116c8e6c95b73391_Logo_Preloader.png",
  };
  const response = NextResponse.json({ appearance });
  response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

export async function PUT(request: NextRequest) {
  await assertAdmin(request);
  const body = await request.json().catch(() => ({}));
  const { appearance } = body ?? {};

  try {
    // Use global blocks API instead of legacy appearance settings
    const { saveGlobalBlock } = await import("@/lib/global-blocks");
    if (appearance?.homeHeroImageUrl !== undefined) {
      await saveGlobalBlock("home-hero", { imageUrl: appearance.homeHeroImageUrl || null });
    }
    if (appearance?.transitionImageUrl !== undefined) {
      await saveGlobalBlock("page-transition", { imageUrl: appearance.transitionImageUrl || null });
    }
    const blocks = await getGlobalBlocks();
    const updated = {
      homeHeroImageUrl: blocks["home-hero"]?.imageUrl || "/img/01-ilichevka.jpg",
      transitionImageUrl: blocks["page-transition"]?.imageUrl || "https://cdn.prod.website-files.com/66bb7b4fa99c404bd3587d90/66bb7c2f116c8e6c95b73391_Logo_Preloader.png",
    };
    revalidatePath("/");
    revalidatePath("/masterskaja");
    revalidatePath("/proektirovanie");
    revalidatePath("/kontakty");
    const response = NextResponse.json({ appearance: updated });
    response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    return response;
  } catch (error) {
    console.error("Failed to save appearance settings", error);
    const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка";
    return NextResponse.json({ 
      error: errorMessage.includes("Файл не найден") 
        ? errorMessage 
        : "Не удалось сохранить медиа" 
    }, { status: 500 });
  }
}


