import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-auth";
import { getFounderBiography, saveFounderBiography, getFounderLeadText, saveFounderLeadText } from "@/lib/site-settings";
import { invalidateSiteSettingsCache } from "@/lib/site-settings";
import { revalidatePath } from "next/cache";

export async function GET(request: NextRequest) {
  await assertAdmin(request);
  const [biography, leadText] = await Promise.all([getFounderBiography(), getFounderLeadText()]);
  const response = NextResponse.json({ biography, leadText });
  // Prevent caching
  response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

export async function PUT(request: NextRequest) {
  await assertAdmin(request);
  const body = await request.json().catch(() => ({}));
  const { biography, leadText } = body ?? {};

  try {
    const results: { biography?: Awaited<ReturnType<typeof saveFounderBiography>>; leadText?: string } = {};
    
    if (Array.isArray(biography)) {
      results.biography = await saveFounderBiography(biography);
    }
    
    if (typeof leadText === "string") {
      results.leadText = await saveFounderLeadText(leadText);
    }

    if (!results.biography && !results.leadText) {
      return NextResponse.json({ error: "Необходимо указать biography или leadText" }, { status: 400 });
    }

    invalidateSiteSettingsCache();
    // Revalidate both the page and the API route
    revalidatePath("/masterskaja");
    revalidatePath("/api/admin/founder-biography");
    // Also try to revalidate the entire route segment
    revalidatePath("/", "layout");
    const response = NextResponse.json(results);
    // Prevent caching
    response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    return response;
  } catch (error) {
    console.error("[API PUT /api/admin/founder-biography] Failed to save founder data", error);
    return NextResponse.json({ error: "Не удалось сохранить данные" }, { status: 500 });
  }
}



