import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-auth";
import { deleteLead, leadKey, readLeadDeletions, readLeads, setLeadTestFlag } from "@/lib/lead-storage";
import { LEAD_SOURCES, classifyLeadSource } from "@/lib/lead-source";
import { summarizeLeads } from "@/lib/lead-stats";

/**
 * Счётчик заявок для админки: список заявок с форм и сводка по месяцам и источникам.
 * Здесь имена и телефоны — роут отвечает только администратору и ничего не кеширует.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

/** assertAdmin бросает готовый ответ 401 — отдаём его как есть, остальное пробрасываем. */
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

  try {
    const [leads, deletions] = await Promise.all([readLeads(), readLeadDeletions()]);

    return NextResponse.json(
      {
        sources: LEAD_SOURCES,
        summary: summarizeLeads(leads),
        // Журнал удалений: без имён и телефонов, только даты и причина.
        deletions: deletions.slice(0, 100),
        leads: leads.map((lead) => ({
          key: leadKey(lead),
          createdAt: lead.createdAt,
          form: lead.source,
          name: lead.name,
          phone: lead.phone,
          sourceId: classifyLeadSource(lead.attribution),
          landingPage: lead.attribution?.landingPage ?? null,
          pageUrl: lead.attribution?.pageUrl ?? null,
          referrer: lead.attribution?.referrer ?? null,
          campaign: lead.attribution?.utm_campaign ?? null,
          hasQuiz: Boolean(lead.quiz),
          consentEdition: lead.consent?.edition ?? null,
          unverified: Boolean(lead.unverified),
          isTest: Boolean(lead.isTest),
        })),
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    console.error("[admin-leads] read failed", error);
    return NextResponse.json({ message: "Не удалось прочитать файл заявок." }, { status: 500, headers: NO_STORE });
  }
}

export async function PATCH(request: NextRequest) {
  const denied = await guard(request);
  if (denied) {
    return denied;
  }

  const body = (await request.json().catch(() => null)) as { key?: unknown; isTest?: unknown } | null;

  if (!body || typeof body.key !== "string" || typeof body.isTest !== "boolean") {
    return NextResponse.json({ message: "Нужны поля key и isTest." }, { status: 400, headers: NO_STORE });
  }

  try {
    const found = await setLeadTestFlag(body.key, body.isTest);
    if (!found) {
      return NextResponse.json({ message: "Заявка не найдена." }, { status: 404, headers: NO_STORE });
    }
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    console.error("[admin-leads] update failed", error);
    return NextResponse.json({ message: "Не удалось сохранить отметку." }, { status: 500, headers: NO_STORE });
  }
}

/**
 * Удаление заявки: человек вправе отозвать согласие и потребовать уничтожить свои данные.
 * Удаляется запись в файле сайта; письмо с этой заявкой в почтовом ящике удаляют отдельно.
 */
export async function DELETE(request: NextRequest) {
  const denied = await guard(request);
  if (denied) {
    return denied;
  }

  const body = (await request.json().catch(() => null)) as { key?: unknown } | null;

  if (!body || typeof body.key !== "string") {
    return NextResponse.json({ message: "Нужно поле key." }, { status: 400, headers: NO_STORE });
  }

  try {
    const found = await deleteLead(body.key);
    if (!found) {
      return NextResponse.json({ message: "Заявка не найдена." }, { status: 404, headers: NO_STORE });
    }
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    console.error("[admin-leads] delete failed", error);
    return NextResponse.json({ message: "Не удалось удалить заявку." }, { status: 500, headers: NO_STORE });
  }
}
