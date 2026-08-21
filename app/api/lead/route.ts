import { NextRequest, NextResponse } from "next/server";
import { saveLead } from "@/lib/lead-storage";
import { sendLeadEmail } from "@/lib/lead-mailer";
import { sendLeadTelegram } from "@/lib/lead-telegram";
import { verifyYandexSmartCaptcha } from "@/lib/yandex-smart-captcha";

type LeadPayload = {
  name?: string;
  phone?: string;
  source?: string;
  captchaToken?: string;
  company?: string;
};

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_PER_IP = 5;
const recentRequestsByIp = new Map<string, number[]>();

function isRateLimited(ip: string | null) {
  if (!ip) {
    return false;
  }

  const now = Date.now();
  const recent = (recentRequestsByIp.get(ip) ?? []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= RATE_LIMIT_MAX_PER_IP) {
    recentRequestsByIp.set(ip, recent);
    return true;
  }

  recent.push(now);
  recentRequestsByIp.set(ip, recent);
  return false;
}

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

  // Honeypot: скрытое поле заполняют только боты — тихо отвечаем успехом.
  if (payload?.company?.trim()) {
    return NextResponse.json({ ok: true });
  }

  if (!name || !phone) {
    return NextResponse.json({ message: "Заполните имя и телефон." }, { status: 400 });
  }

  if (phone.replace(/\D/g, "").length < 11) {
    return NextResponse.json({ message: "Укажите номер телефона полностью." }, { status: 400 });
  }

  if (isRateLimited(remoteIp)) {
    return NextResponse.json({ message: "Слишком много заявок. Попробуйте позже." }, { status: 429 });
  }

  // Токен есть — проверяем; поддельный токен отклоняем. Токена нет — пропускаем:
  // виджет капчи может не загрузиться у реального клиента, заявка важнее.
  let captchaVerified = false;

  if (payload?.captchaToken) {
    captchaVerified = await verifyYandexSmartCaptcha(payload.captchaToken, remoteIp);

    if (!captchaVerified) {
      return NextResponse.json({ message: "Не удалось пройти проверку капчи." }, { status: 400 });
    }
  }

  const lead = {
    name,
    phone,
    source: captchaVerified ? source : `${source} (капча не пройдена)`,
    ip: remoteIp,
  };

  await saveLead(lead);

  sendLeadTelegram(lead).catch((error) => {
    console.error("Lead telegram delivery failed", error);
  });

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
