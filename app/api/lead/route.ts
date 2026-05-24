import { NextRequest, NextResponse } from "next/server";
import { saveLead } from "@/lib/lead-storage";
import { sendLeadEmail } from "@/lib/lead-mailer";
import { verifyYandexSmartCaptcha } from "@/lib/yandex-smart-captcha";

type LeadPayload = {
  name?: string;
  phone?: string;
  source?: string;
  captchaToken?: string;
};

function getRemoteIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return request.headers.get("x-real-ip");
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as LeadPayload | null;
  const name = payload?.name?.trim();
  const phone = payload?.phone?.trim();
  const source = payload?.source?.trim() || "Сайт";
  const remoteIp = getRemoteIp(request);

  if (!name || !phone) {
    return NextResponse.json({ message: "Заполните имя и телефон." }, { status: 400 });
  }

  const captchaPassed = await verifyYandexSmartCaptcha(payload?.captchaToken, remoteIp);

  if (!captchaPassed) {
    return NextResponse.json({ message: "Не удалось пройти проверку капчи." }, { status: 400 });
  }

  const lead = {
    name,
    phone,
    source,
    ip: remoteIp,
  };

  await saveLead(lead);

  try {
    await sendLeadEmail(lead);
  } catch (error) {
    console.error("Lead email delivery failed", error);
    return NextResponse.json(
      { message: "Заявка сохранена, но почта пока не настроена. Мы уже видим обращение." },
      { status: 202 },
    );
  }

  return NextResponse.json({ ok: true });
}
