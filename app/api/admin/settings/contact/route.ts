import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-auth";
import {
  getContactSettings,
  getSocialLinks,
  saveContactSettings,
  saveSocialLinks,
} from "@/lib/site-settings";
import { invalidateSiteSettingsCache } from "@/lib/site-settings";
import { revalidatePath } from "next/cache";

export async function GET(request: NextRequest) {
  await assertAdmin(request);
  const [contact, socials] = await Promise.all([getContactSettings(), getSocialLinks()]);
  const response = NextResponse.json({ contact, socials });
  response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

export async function PUT(request: NextRequest) {
  await assertAdmin(request);
  const body = await request.json().catch(() => ({}));
  const { contact, socials } = body ?? {};

  try {
    const [updatedContact, updatedSocials] = await Promise.all([
      contact ? saveContactSettings(contact) : getContactSettings(),
      socials ? saveSocialLinks(socials) : getSocialLinks(),
    ]);

    invalidateSiteSettingsCache();
    revalidatePath("/");
    revalidatePath("/masterskaja");
    revalidatePath("/proektirovanie");
    revalidatePath("/kontakty");

    const response = NextResponse.json({ contact: updatedContact, socials: updatedSocials });
    response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    return response;
  } catch (error) {
    console.error("Failed to save contact settings", error);
    return NextResponse.json({ error: "Не удалось сохранить настройки" }, { status: 500 });
  }
}

