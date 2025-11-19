import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-auth";
import { getPublications, savePublications } from "@/lib/site-settings";
import { invalidateSiteSettingsCache } from "@/lib/site-settings";
import { revalidatePath } from "next/cache";

export async function GET(request: NextRequest) {
  await assertAdmin(request);
  const publications = await getPublications();
  return NextResponse.json({ publications });
}

export async function PUT(request: NextRequest) {
  await assertAdmin(request);
  const body = await request.json().catch(() => ({}));
  const { publications } = body ?? {};

  if (!Array.isArray(publications)) {
    return NextResponse.json({ error: "Публикации должны быть массивом" }, { status: 400 });
  }

  try {
    const updated = await savePublications(publications);
    invalidateSiteSettingsCache();
    revalidatePath("/masterskaja");
    return NextResponse.json({ publications: updated });
  } catch (error) {
    console.error("Failed to save publications", error);
    return NextResponse.json({ error: "Не удалось сохранить публикации" }, { status: 500 });
  }
}

