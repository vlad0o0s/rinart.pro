import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-auth";
import { getFounderBiography, saveFounderBiography, getFounderLeadText, saveFounderLeadText } from "@/lib/site-settings";
import { invalidateSiteSettingsCache } from "@/lib/site-settings";
import { revalidatePath } from "next/cache";

export async function GET(request: NextRequest) {
  await assertAdmin(request);
  const [biography, leadText] = await Promise.all([getFounderBiography(), getFounderLeadText()]);
  return NextResponse.json({ biography, leadText });
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
    revalidatePath("/masterskaja");
    return NextResponse.json(results);
  } catch (error) {
    console.error("Failed to save founder data", error);
    return NextResponse.json({ error: "Не удалось сохранить данные" }, { status: 500 });
  }
}



