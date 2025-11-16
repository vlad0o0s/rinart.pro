import { NextResponse } from "next/server";
import { getAppearanceSettings } from "@/lib/site-settings";

export async function GET() {
  const appearance = await getAppearanceSettings();
  return NextResponse.json({ appearance }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate" } });
}


