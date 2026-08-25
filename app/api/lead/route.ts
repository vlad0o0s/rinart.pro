import { NextRequest, NextResponse } from "next/server";
import { saveLead, type LeadRequest } from "@/lib/lead-storage";
import { isLeadMailConfigured, sendLeadEmail } from "@/lib/lead-mailer";
import { isLeadTelegramConfigured, sendLeadTelegram } from "@/lib/lead-telegram";
import { verifyYandexSmartCaptcha } from "@/lib/yandex-smart-captcha";
import {
  LEAD_LIMITS,
  clampText,
  normalizeAttribution,
  normalizePhone,
  normalizeQuiz,
} from "@/lib/lead-validation";

type LeadPayload = {
  name?: unknown;
  phone?: unknown;
  source?: unknown;
  captchaToken?: unknown;
  company?: unknown;
  consent?: unknown;
  quiz?: unknown;
  attribution?: unknown;
};

/** Ориентир из ТЗ: три заявки с одного адреса за десять минут. Четвёртая — уже перебор. */
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_PER_IP = 3;

/** Тело заявки — это два поля и ответы квиза. Мегабайтный JSON разбирать незачем. */
const MAX_BODY_BYTES = 16 * 1024;

const recentLeadsByIp = new Map<string, number[]>();

/**
 * Счётчик считает только созданные заявки, а не все запросы: человек, у которого
 * сорвалась отправка и который нажал «Попробовать ещё раз», не должен упереться в лимит.
 */
function consumeRateLimit(ip: string | null) {
  if (!ip) {
    return true;
  }

  const now = Date.now();
  const recent = (recentLeadsByIp.get(ip) ?? []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= RATE_LIMIT_MAX_PER_IP) {
    recentLeadsByIp.set(ip, recent);
    return false;
  }

  recent.push(now);
  recentLeadsByIp.set(ip, recent);

  // Карта живёт столько же, сколько процесс: без уборки она растёт на каждый новый адрес.
  if (recentLeadsByIp.size > 5000) {
    for (const [key, timestamps] of recentLeadsByIp) {
      if (!timestamps.some((ts) => now - ts < RATE_LIMIT_WINDOW_MS)) {
        recentLeadsByIp.delete(key);
      }
    }
  }

  return true;
}

function getRemoteIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return request.headers.get("x-real-ip");
}

/**
 * В журнал попадает только причина отказа. Имени, телефона и токена капчи здесь быть
 * не может: журналы читают и хранят дольше, чем сами заявки.
 */
function logLead(event: string, details: Record<string, string | number | boolean | null>) {
  console.warn(`[lead] ${event}`, JSON.stringify(details));
}

export async function POST(request: NextRequest) {
  const remoteIp = getRemoteIp(request);

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    logLead("rejected", { reason: "body_too_large", bytes: declaredLength });
    return NextResponse.json({ ok: false, message: "Слишком большой запрос." }, { status: 413 });
  }

  const payload = (await request.json().catch(() => null)) as LeadPayload | null;

  if (!payload) {
    logLead("rejected", { reason: "invalid_json" });
    return NextResponse.json({ ok: false, message: "Не удалось прочитать заявку." }, { status: 400 });
  }

  // Honeypot: поле скрыто от людей, его заполняют только боты. Отвечаем как при успехе,
  // чтобы бот не подбирал обход, но лид не создаём.
  if (clampText(payload.company, 100)) {
    logLead("honeypot", { reason: "company_filled" });
    return NextResponse.json({ ok: true });
  }

  const name = clampText(payload.name, LEAD_LIMITS.name);
  const source = clampText(payload.source, LEAD_LIMITS.source) || "Сайт";
  const phone = normalizePhone(payload.phone);

  // Имя необязательное, телефон — обязательный: по нему и перезванивают.
  if (!phone) {
    logLead("rejected", { reason: "phone_invalid" });
    return NextResponse.json(
      { ok: false, message: "Укажите телефон полностью — 11 цифр российского номера." },
      { status: 400 },
    );
  }

  if (payload.consent !== true) {
    logLead("rejected", { reason: "consent_missing" });
    return NextResponse.json(
      { ok: false, message: "Нужно согласие на обработку персональных данных." },
      { status: 400 },
    );
  }

  const captchaToken = typeof payload.captchaToken === "string" ? payload.captchaToken : "";
  const verdict = await verifyYandexSmartCaptcha(captchaToken, remoteIp);

  if (verdict.status === "failed") {
    logLead("rejected", { reason: "captcha_failed" });
    return NextResponse.json(
      { ok: false, message: "Не удалось пройти проверку. Обновите страницу и попробуйте ещё раз." },
      { status: 400 },
    );
  }

  /**
   * Капча не подтверждена — но заявка живого человека важнее. Пропускаем её помеченной:
   * honeypot выше и лимит по адресу ниже продолжают работать, поэтому это не безусловный
   * пропуск, а известный компромисс с видимым следом в журнале и в уведомлении.
   */
  const unverified = verdict.status !== "ok";

  if (unverified) {
    logLead("captcha_unverified", { reason: verdict.reason });
  }

  if (!consumeRateLimit(remoteIp)) {
    logLead("rejected", { reason: "rate_limited", unverified });
    return NextResponse.json(
      { ok: false, message: "Слишком много заявок с этого адреса. Попробуйте позже или позвоните нам." },
      { status: 429 },
    );
  }

  const lead: LeadRequest = {
    name,
    phone,
    source,
    ip: remoteIp,
    quiz: normalizeQuiz(payload.quiz),
    attribution: normalizeAttribution(payload.attribution),
    unverified,
    createdAt: new Date().toISOString(),
  };

  // Сначала сохраняем: файл — источник правды, из него заявку достанут даже если
  // оба канала уведомлений лежат. Если не сохранилось — честно отвечаем ошибкой,
  // иначе человек уйдёт с экраном «спасибо», а заявки не будет нигде.
  try {
    await saveLead(lead);
  } catch (error) {
    console.error("[lead] storage failed", error);
    return NextResponse.json(
      { ok: false, message: "Не удалось сохранить заявку. Позвоните нам, пожалуйста." },
      { status: 500 },
    );
  }

  const [telegramResult, emailResult] = await Promise.allSettled([
    sendLeadTelegram(lead),
    isLeadMailConfigured() ? sendLeadEmail(lead) : Promise.reject(new Error("smtp_not_configured")),
  ]);

  const telegramDelivered = telegramResult.status === "fulfilled" && telegramResult.value === true;
  const emailDelivered = emailResult.status === "fulfilled";

  if (!telegramDelivered) {
    logLead("telegram_not_delivered", {
      reason: isLeadTelegramConfigured() ? "send_failed" : "not_configured",
    });
  }

  if (!emailDelivered) {
    logLead("email_not_delivered", {
      reason: isLeadMailConfigured() ? "send_failed" : "not_configured",
    });
  }

  // Ни один канал не сработал — заявка есть только в файле. Это авария: её видно
  // в журнале, но человеку показываем успех, потому что заявка принята и не потеряна.
  if (!telegramDelivered && !emailDelivered) {
    logLead("delivery_failed", { reason: "all_channels_failed", unverified });
  }

  return NextResponse.json({ ok: true });
}
