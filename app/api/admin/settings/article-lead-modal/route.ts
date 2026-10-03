import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-auth";
import { getArticleLeadModalSettings, saveArticleLeadModalSettings } from "@/lib/article-lead-modal-repository";

export const dynamic = "force-dynamic";

/** assertAdmin бросает готовый ответ 401 — отдаём его как есть. */
async function guard(request: NextRequest): Promise<Response | null> {
  try {
    await assertAdmin(request);
    return null;
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    throw error;
  }
}

export async function GET(request: NextRequest) {
  const denied = await guard(request);
  if (denied) {
    return denied;
  }

  return NextResponse.json(
    { settings: await getArticleLeadModalSettings() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function PUT(request: NextRequest) {
  const denied = await guard(request);
  if (denied) {
    return denied;
  }

  const body = (await request.json().catch(() => null)) as { settings?: unknown } | null;
  if (!body || typeof body.settings !== "object" || body.settings === null) {
    return NextResponse.json({ error: "Не удалось прочитать настройки окна" }, { status: 400 });
  }

  try {
    // Страницы статей собираются на каждый запрос, а сохранение сбрасывает кеш настроек,
    // поэтому новые тексты видны сразу.
    const settings = await saveArticleLeadModalSettings(body.settings);
    return NextResponse.json({ settings }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[Admin][API] Failed to save article lead modal settings", error);
    return NextResponse.json({ error: "Не удалось сохранить настройки окна" }, { status: 500 });
  }
}
