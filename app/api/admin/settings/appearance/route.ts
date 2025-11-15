import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-auth";
import { getAppearanceSettings, saveAppearanceSettings, invalidateSiteSettingsCache } from "@/lib/site-settings";
import { revalidatePath } from "next/cache";

export async function GET(request: NextRequest) {
  await assertAdmin(request);
  const appearance = await getAppearanceSettings();
  return NextResponse.json({ appearance });
}

export async function PUT(request: NextRequest) {
  await assertAdmin(request);
  const body = await request.json().catch(() => ({}));
  const { appearance } = body ?? {};

  try {
    const updated = await saveAppearanceSettings(appearance);
    invalidateSiteSettingsCache();
    revalidatePath("/");
    revalidatePath("/masterskaja");
    revalidatePath("/proektirovanie");
    revalidatePath("/kontakty");
    return NextResponse.json({ appearance: updated });
  } catch (error) {
    console.error("Failed to save appearance settings", error);
    return NextResponse.json({ error: "Не удалось сохранить медиа" }, { status: 500 });
  }
}


