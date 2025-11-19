import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-auth";
import { getFounderBiography, saveFounderBiography } from "@/lib/site-settings";
import { invalidateSiteSettingsCache } from "@/lib/site-settings";
import { revalidatePath } from "next/cache";

export async function GET(request: NextRequest) {
  await assertAdmin(request);
  const biography = await getFounderBiography();
  return NextResponse.json({ biography });
}

export async function PUT(request: NextRequest) {
  await assertAdmin(request);
  const body = await request.json().catch(() => ({}));
  const { biography } = body ?? {};

  if (!Array.isArray(biography)) {
    return NextResponse.json({ error: "Биография должна быть массивом блоков" }, { status: 400 });
  }

  try {
    const updated = await saveFounderBiography(biography);
    invalidateSiteSettingsCache();
    revalidatePath("/masterskaja");
    return NextResponse.json({ biography: updated });
  } catch (error) {
    console.error("Failed to save founder biography", error);
    return NextResponse.json({ error: "Не удалось сохранить биографию" }, { status: 500 });
  }
}


