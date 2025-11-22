import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-auth";
import { getPublications, savePublications } from "@/lib/site-settings";
import { invalidateSiteSettingsCache } from "@/lib/site-settings";
import { revalidatePath } from "next/cache";

export async function GET(request: NextRequest) {
  await assertAdmin(request);
  const publications = await getPublications();
  const response = NextResponse.json({ publications });
  response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
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
    const response = NextResponse.json({ publications: updated });
    response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    return response;
  } catch (error) {
    console.error("Failed to save publications", error);
    return NextResponse.json({ error: "Не удалось сохранить публикации" }, { status: 500 });
  }
}

