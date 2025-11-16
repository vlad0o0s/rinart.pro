import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-auth";
import { getSocialLinks, saveSocialLinks } from "@/lib/site-settings";

export async function GET(request: NextRequest) {
  await assertAdmin(request);
  const links = await getSocialLinks();
  return NextResponse.json({ links });
}

export async function PUT(request: NextRequest) {
  await assertAdmin(request);
  const body = (await request.json().catch(() => ({}))) as { links?: Array<{ id: string; label?: string; url?: string }> };

  try {
    console.log("[Admin-Social] PUT start", { incoming: body?.links });
  } catch {}

  const current = await getSocialLinks();
  const incoming = Array.isArray(body.links) ? body.links : [];
  const map = new Map(current.map((l) => [l.id, l]));
  incoming.forEach((item) => {
    const prev = map.get(item.id);
    if (!prev) return;
    map.set(item.id, {
      ...prev,
      label: typeof item.label === "string" ? item.label : prev.label,
      url: typeof item.url === "string" ? item.url : prev.url,
    });
  });
  const next = Array.from(map.values());
  const saved = await saveSocialLinks(next);

  try {
    console.log("[Admin-Social] PUT saved", { saved });
  } catch {}

  return NextResponse.json({ links: saved });
}

