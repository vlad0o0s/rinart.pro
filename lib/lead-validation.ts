/**
 * Правила заявки, общие для клиента и сервера.
 *
 * Раньше проверки жили только в компоненте формы, а роут API повторял их своими словами:
 * клиент требовал 10 цифр без кода страны, сервер — 11 с кодом. Любая правка формы могла
 * разойтись с сервером незаметно. Здесь один источник правды, поэтому модуль намеренно
 * не импортирует ни React, ни next: его одинаково можно вызвать из браузера, из роута
 * и из тестов.
 */

import { CONSENT_EDITION } from "./legal";

/** Верхние границы длины. Всё, что приходит извне, обрезается — не только ради базы,
 *  но и чтобы в Telegram не улетало сообщение на мегабайт. */
export const LEAD_LIMITS = {
  name: 80,
  phone: 32,
  source: 200,
  quizField: 120,
  estimate: 120,
  utm: 200,
  url: 500,
  referrer: 500,
  userAgent: 300,
} as const;

/** Схлопывает переводы строк и пробелы, режет по длине. Нестроки превращает в "". */
export function clampText(value: unknown, max: number): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function phoneDigits(value: unknown): string {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

/**
 * Российский номер в каноничном виде `+7XXXXXXXXXX`.
 * `8 903 …`, `+7 903 …` и `903 …` — один и тот же номер, поэтому приводим к одному виду
 * до сравнения и до отправки. `null` означает «это не российский номер».
 */
export function normalizePhone(value: unknown): string | null {
  let digits = phoneDigits(value);

  if (digits.length === 10) {
    digits = `7${digits}`;
  } else if (digits.length === 11 && digits.startsWith("8")) {
    digits = `7${digits.slice(1)}`;
  }

  if (digits.length !== 11 || !digits.startsWith("7")) {
    return null;
  }

  return `+${digits}`;
}

export function isValidPhone(value: unknown): boolean {
  return normalizePhone(value) !== null;
}

/**
 * Редакция согласия, которую показала форма. Приходит с клиента: страница могла быть
 * открыта до выхода новой редакции, и человек соглашался именно с прежним текстом.
 * Всё, что не похоже на дату редакции, заменяется текущей.
 */
export function normalizeConsentEdition(value: unknown): string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : CONSENT_EDITION;
}

export type QuizContext = {
  houseType: string;
  floors: string;
  area: string;
  timing: string;
  estimate: string;
};

/** Ответы квиза приходят с клиента, поэтому обрезаются наравне с остальным вводом. */
export function normalizeQuiz(raw: unknown): QuizContext | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const source = raw as Record<string, unknown>;
  const quiz: QuizContext = {
    houseType: clampText(source.houseType, LEAD_LIMITS.quizField),
    floors: clampText(source.floors, LEAD_LIMITS.quizField),
    area: clampText(source.area, LEAD_LIMITS.quizField),
    timing: clampText(source.timing, LEAD_LIMITS.quizField),
    estimate: clampText(source.estimate, LEAD_LIMITS.estimate),
  };

  return Object.values(quiz).some(Boolean) ? quiz : null;
}

export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type UtmKey = (typeof UTM_KEYS)[number];

export type Attribution = Partial<Record<UtmKey, string>> & {
  yclid?: string;
  pageUrl?: string;
  referrer?: string;
  /** Страница входа — путь первой страницы визита, без домена и query. */
  landingPage?: string;
};

/** Метки рекламы тоже клиентские данные: доверять им как есть нельзя. */
export function normalizeAttribution(raw: unknown): Attribution {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const source = raw as Record<string, unknown>;
  const attribution: Attribution = {};

  for (const key of UTM_KEYS) {
    const value = clampText(source[key], LEAD_LIMITS.utm);
    if (value) {
      attribution[key] = value;
    }
  }

  const yclid = clampText(source.yclid, LEAD_LIMITS.utm);
  if (yclid) {
    attribution.yclid = yclid;
  }

  const pageUrl = clampText(source.pageUrl, LEAD_LIMITS.url);
  if (pageUrl) {
    attribution.pageUrl = pageUrl;
  }

  const referrer = clampText(source.referrer, LEAD_LIMITS.referrer);
  if (referrer) {
    attribution.referrer = referrer;
  }

  // Страница входа — только путь внутри сайта: чужой адрес сюда попасть не должен.
  const landingPage = clampText(source.landingPage, LEAD_LIMITS.url);
  if (landingPage.startsWith("/") && !landingPage.startsWith("//")) {
    attribution.landingPage = landingPage;
  }

  return attribution;
}
