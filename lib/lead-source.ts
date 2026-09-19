/**
 * Откуда пришёл человек, оставивший заявку.
 *
 * Источник не хранится в заявке, а вычисляется при показе из меток и реферера:
 * правила можно уточнять, и старые заявки пересчитаются вместе с новыми.
 * Модуль без React и next — его вызывают и роут админки, и тесты.
 */

import type { Attribution } from "./lead-validation";

export const LEAD_SOURCES = [
  { id: "yandex", label: "Яндекс: поиск" },
  { id: "yandex-maps", label: "Яндекс Карты" },
  { id: "google", label: "Google" },
  { id: "search-other", label: "Другой поиск" },
  { id: "ads", label: "Реклама" },
  { id: "social", label: "Соцсети и Дзен" },
  { id: "tagged", label: "Ссылки с метками" },
  { id: "referral", label: "Другие сайты" },
  { id: "direct", label: "Прямой заход" },
] as const;

export type LeadSourceId = (typeof LEAD_SOURCES)[number]["id"];

const AD_MEDIUM = /^(cpc|ppc|cpm|cpa|paid|display|banner|retarget)/i;
const SOCIAL_MARK = /social|smm|vk|telegram|^tg$|instagram|dzen|zen|pinterest|youtube|max/i;
const MAPS_MARK = /maps|карт/i;

// Только сам поиск: почта, диск и прочие поддомены Яндекса — это «другие сайты».
const YANDEX_HOST = /^(yandex\.(ru|by|kz|uz|com|com\.tr|com\.am|com\.ge|az|md|tj|tm|ee|lt|lv|fr|eu)|ya\.ru)$/;
const GOOGLE_HOST = /^google\.[a-z.]+$/;
const OTHER_SEARCH_HOSTS = new Set(["bing.com", "duckduckgo.com", "go.mail.ru", "yahoo.com", "search.yahoo.com", "nova.rambler.ru", "rambler.ru"]);
const SOCIAL_HOST = /(^|\.)(vk\.com|vk\.ru|t\.me|telegram\.org|instagram\.com|facebook\.com|ok\.ru|dzen\.ru|zen\.yandex\.ru|youtube\.com|max\.ru)$|(^|\.)pinterest\.[a-z.]+$/;

export function classifyLeadSource(attribution: Attribution | null | undefined): LeadSourceId {
  if (!attribution) {
    return "direct";
  }

  const medium = attribution.utm_medium ?? "";
  const utmSource = attribution.utm_source ?? "";

  // Метки точнее реферера: рекламный клик из поиска приходит с реферером Яндекса.
  if (attribution.yclid || AD_MEDIUM.test(medium)) {
    return "ads";
  }

  if (utmSource || medium) {
    if (MAPS_MARK.test(utmSource)) {
      return "yandex-maps";
    }
    return SOCIAL_MARK.test(utmSource) || SOCIAL_MARK.test(medium) ? "social" : "tagged";
  }

  if (!attribution.referrer) {
    return "direct";
  }

  let url: URL;
  try {
    url = new URL(attribution.referrer);
  } catch {
    return "referral";
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  if (YANDEX_HOST.test(host)) {
    // Браузеры обычно отдают только домен, поэтому переход с Карт без меток
    // неотличим от поиска. Путь виден редко — но если виден, используем его.
    return /^\/(maps|profile|uslugi)/.test(url.pathname) ? "yandex-maps" : "yandex";
  }
  if (GOOGLE_HOST.test(host)) {
    return "google";
  }
  if (OTHER_SEARCH_HOSTS.has(host)) {
    return "search-other";
  }
  if (SOCIAL_HOST.test(host)) {
    return "social";
  }
  return "referral";
}
