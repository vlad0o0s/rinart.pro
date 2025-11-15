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
  return NextResponse.json({ contact, socials });
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

    return NextResponse.json({ contact: updatedContact, socials: updatedSocials });
  } catch (error) {
    console.error("Failed to save contact settings", error);
    return NextResponse.json({ error: "Не удалось сохранить настройки" }, { status: 500 });
  }
}

