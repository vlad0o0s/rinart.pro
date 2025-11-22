import { fetchAllSiteSettings, upsertSiteSetting, findSiteSettingByKey } from "./site-settings-repository";
import type { AppearanceSettings, ContactSettings, SocialLink, SocialPlatform } from "@/types/site";

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const CACHE_TTL = 60 * 1000;

let contactCache: CacheEntry<ContactSettings> | null = null;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let socialCache: CacheEntry<SocialLink[]> | null = null;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let appearanceCache: CacheEntry<AppearanceSettings> | null = null;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let publicationsCache: CacheEntry<string[]> | null = null;

const DEFAULT_CONTACT_SETTINGS: ContactSettings = {
  heroTitle: "Контактная информация",
  phoneLabel: "+7 903 147-44-30",
  phoneHref: "tel:+79031474430",
  emailLabel: "rinartburo@mail.ru",
  emailHref: "mailto:rinartburo@mail.ru",
  locationLabel: "Москва, Российская Федерация",
  heroImageUrl: "/img/group-1005.webp",
  footerTitle: "Обсудим ваш проект:",
  cityLabel: "г. Москва",
  whatsappLabel: "Написать в WhatsApp",
  whatsappUrl: "https://wa.me/79031474430",
  backToTopLabel: "В начало",
};

const DEFAULT_SOCIAL_LINKS: SocialLink[] = [
  { id: "instagram", platform: "instagram", label: "INST: rinart.buro", url: "https://www.instagram.com/rinart.buro/" },
  { id: "telegram", platform: "telegram", label: "TG: rinart_buro", url: "https://t.me/rinart_buro" },
  { id: "vk", platform: "vk", label: "VK: rinart_buro", url: "https://vk.com/rinart_buro" },
  { id: "pinterest", platform: "pinterest", label: "Pinterest: rinartburo", url: "https://www.pinterest.com/rinartburo" },
];

const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  homeHeroImageUrl: "/img/01-ilichevka.jpg",
  transitionImageUrl: "https://cdn.prod.website-files.com/66bb7b4fa99c404bd3587d90/66bb7c2f116c8e6c95b73391_Logo_Preloader.png",
};

const DEFAULT_PUBLICATIONS: string[] = [
  "Финалист конкурса на лучший «Проект шоу-рума НЛК Домостроение на территории Центра дизайна ARTPLAY»",
  "Финалист конкурса «Активный дом 2012»",
  "Шорт лист конкурса «Скамья для Николы»",
  "Публикация в журнале «Проект Россия» № 63",
  "Участие в конкурсе «Дерево в архитектуре»",
  "Лонг лист конкурса «Николин Бельведер», проект «Вавилон.ru»",
  "1-e место «Архновация» — «Архитектурные произведения и проекты», в составе мастерской Н. В. Белоусова",
  "Публикация в журнале «Татлин моно». Молодые архитекторы России",
  "Диплом 3 степени, конкурс «3d-дом для экопарка Ясное Поле»",
];

export type FounderBiographyBlock = {
  year: string;
  lines: string[];
};

const DEFAULT_FOUNDER_LEAD_TEXT = "Занимаюсь проектированием больше 20 лет. Мастерская создана в 2024 году. Окончил Архитектурно Строительную Академию в г. Казани.";

const DEFAULT_FOUNDER_BIOGRAPHY: FounderBiographyBlock[] = [
  {
    year: "1977 г.",
    lines: [
      "Родился в Чимкенте, СССР",
      "художественное училище им.Кастеева, факультет дизайна. Чимкент",
      "Казанская Государственная Архитектурно-Строительная Академия, Кафедра АП Казань",
    ],
  },
  {
    year: "1992-1996 гг.",
    lines: [
      "художественное училище им.Кастеева, факультет дизайна. Чимкент",
      "Казанская Государственная Архитектурно-Строительная Академия, Кафедра АП Казань",
      "архитектор, ГУП « Татинвестгражданпроект» мастерская №1,под рук-вом Бакулина Г.А. Казань",
    ],
  },
  {
    year: "1998-2004 гг.",
    lines: [
      "Казанская Государственная Архитектурно-Строительная Академия, Кафедра АП Казань",
      "архитектор, ГУП « Татинвестгражданпроект» мастерская №1,под рук-вом Бакулина Г.А. Казань",
      "кафедра Архитектурного проектирования, КГАСА, Казань",
    ],
  },
  {
    year: "2004-2007 гг.",
    lines: [
      "архитектор, ГУП « Татинвестгражданпроект» мастерская №1,под рук-вом Бакулина Г.А. Казань",
      "кафедра Архитектурного проектирования, КГАСА, Казань",
      'архитектор, "Сергей Скуратов architects", Москва',
    ],
  },
  {
    year: "2006-2007 гг.",
    lines: [
      "кафедра Архитектурного проектирования, КГАСА, Казань",
      'архитектор, "Сергей Скуратов architects", Москва',
      "архитектор, мастерская Белоусова Н.В., Москва",
    ],
  },
  {
    year: "2007-2008 гг.",
    lines: [
      'архитектор, "Сергей Скуратов architects", Москва',
      "архитектор, мастерская Белоусова Н.В., Москва",
      "Персональная творческая мастерская",
    ],
  },
  {
    year: "2020 г.",
    lines: ["Персональная творческая мастерская", "член Союза архитекторов России"],
  },
];

function readCache<T>(entry: CacheEntry<T> | null): T | null {
  if (!entry || entry.expiresAt < Date.now()) {
    return null;
  }
  return entry.value;
}

function writeCache<T>(setter: (entry: CacheEntry<T>) => void, value: T) {
  setter({ value, expiresAt: Date.now() + CACHE_TTL });
}

export async function getContactSettings(): Promise<ContactSettings> {
  const cached = readCache(contactCache);
  if (cached) {
    return cached;
  }

  const settings = await fetchAllSiteSettings();
  const record = settings.find((item) => item.key === "contact");
  const merged = normalizeContactSettings(record?.value);
  writeCache((entry) => {
    contactCache = entry;
  }, merged);
  return merged;
}

export async function getSocialLinks(): Promise<SocialLink[]> {
  // Always read fresh to reflect admin changes immediately across the site
  const settings = await fetchAllSiteSettings();
  const record = settings.find((item) => item.key === "socialLinks");
  const links = normalizeSocialLinks(record?.value);
  // Do not cache to avoid any delay in propagation
  socialCache = null;
  return links;
}

export async function saveContactSettings(payload: ContactSettings): Promise<ContactSettings> {
  const sanitized = normalizeContactSettings(payload);
  await upsertSiteSetting("contact", sanitized);
  contactCache = null;
  return sanitized;
}

export async function saveSocialLinks(payload: SocialLink[]): Promise<SocialLink[]> {
  const sanitized = normalizeSocialLinks(payload);
  await upsertSiteSetting("socialLinks", sanitized);
  socialCache = null;
  return sanitized;
}

export async function getAppearanceSettings(): Promise<AppearanceSettings> {
  // Read the single key directly to avoid any stale merged reads
  const record = await findSiteSettingByKey("appearance");
  const appearance = normalizeAppearanceSettings(record?.value);
  // Optionally cache for short time if needed in the future
  appearanceCache = null;
  return appearance;
}

export async function saveAppearanceSettings(payload: AppearanceSettings): Promise<AppearanceSettings> {
  const sanitized = normalizeAppearanceSettings(payload);
  const saved = await upsertSiteSetting("appearance", sanitized);
  appearanceCache = null;
  return normalizeAppearanceSettings(saved?.value);
}

export function normalizeContactSettings(value: unknown): ContactSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_CONTACT_SETTINGS;
  }
  const source = value as Partial<ContactSettings>;
  const heroImageUrl = source.heroImageUrl?.trim() || DEFAULT_CONTACT_SETTINGS.heroImageUrl;
  return {
    heroTitle: stringOrDefault(source.heroTitle, DEFAULT_CONTACT_SETTINGS.heroTitle),
    phoneLabel: stringOrDefault(source.phoneLabel, DEFAULT_CONTACT_SETTINGS.phoneLabel),
    phoneHref: stringOrDefault(source.phoneHref, DEFAULT_CONTACT_SETTINGS.phoneHref),
    emailLabel: stringOrDefault(source.emailLabel, DEFAULT_CONTACT_SETTINGS.emailLabel),
    emailHref: stringOrDefault(source.emailHref, DEFAULT_CONTACT_SETTINGS.emailHref),
    locationLabel: stringOrDefault(source.locationLabel, DEFAULT_CONTACT_SETTINGS.locationLabel),
    heroImageUrl: heroImageUrl || null,
    footerTitle: stringOrDefault(source.footerTitle, DEFAULT_CONTACT_SETTINGS.footerTitle),
    cityLabel: stringOrDefault(source.cityLabel, DEFAULT_CONTACT_SETTINGS.cityLabel),
    whatsappLabel: stringOrDefault(source.whatsappLabel, DEFAULT_CONTACT_SETTINGS.whatsappLabel),
    whatsappUrl: stringOrDefault(source.whatsappUrl, DEFAULT_CONTACT_SETTINGS.whatsappUrl),
    backToTopLabel: stringOrDefault(source.backToTopLabel, DEFAULT_CONTACT_SETTINGS.backToTopLabel),
  };
}

export function normalizeSocialLinks(value: unknown): SocialLink[] {
  if (!Array.isArray(value)) {
    return DEFAULT_SOCIAL_LINKS;
  }
  const links = value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const source = item as Partial<SocialLink>;
      const platform = isValidPlatform(source.platform) ? source.platform : "instagram";
      const id = typeof source.id === "string" && source.id.trim().length > 0 ? source.id : platform;
      const label = stringOrDefault(source.label, platform.toUpperCase());
      const url = stringOrDefault(source.url, "#");
      return { id, platform, label, url };
    })
    .filter((item): item is SocialLink => Boolean(item && item.url && item.url !== "#"));

  if (!links.length) {
    return DEFAULT_SOCIAL_LINKS;
  }
  return links;
}

export function normalizeAppearanceSettings(value: unknown): AppearanceSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_APPEARANCE_SETTINGS;
  }
  const source = value as Partial<AppearanceSettings>;
  return {
    homeHeroImageUrl: stringOrDefault(source.homeHeroImageUrl, DEFAULT_APPEARANCE_SETTINGS.homeHeroImageUrl),
    transitionImageUrl: stringOrDefault(source.transitionImageUrl, DEFAULT_APPEARANCE_SETTINGS.transitionImageUrl),
  };
}

function stringOrDefault(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
}

function isValidPlatform(value: unknown): value is SocialPlatform {
  return (
    value === "instagram" ||
    value === "telegram" ||
    value === "vk" ||
    value === "pinterest" ||
    value === "behance" ||
    value === "youtube"
  );
}

export async function getPublications(): Promise<string[]> {
  // Always read fresh to reflect admin changes immediately across the site
  const settings = await fetchAllSiteSettings();
  const record = settings.find((item) => item.key === "publications");
  const publications = normalizePublications(record?.value);
  // Do not cache to avoid any delay in propagation
  publicationsCache = null;
  return publications;
}

export async function savePublications(payload: string[]): Promise<string[]> {
  const sanitized = normalizePublications(payload);
  await upsertSiteSetting("publications", sanitized);
  publicationsCache = null;
  return sanitized;
}

export function normalizePublications(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return DEFAULT_PUBLICATIONS;
  }
  const publications = value
    .map((item) => {
      if (typeof item === "string" && item.trim().length > 0) {
        return item.trim();
      }
      return null;
    })
    .filter((item): item is string => Boolean(item));

  if (!publications.length) {
    return DEFAULT_PUBLICATIONS;
  }
  return publications;
}

export async function getFounderBiography(): Promise<FounderBiographyBlock[]> {
  // Always read fresh to reflect admin changes immediately across the site
  // Force fresh read by using findSiteSettingByKey instead of fetchAllSiteSettings
  // Use direct key lookup to avoid any caching issues
  const record = await import("./site-settings-repository").then((m) => m.findSiteSettingByKey("founderBiography"));
  if (!record || record.value === null || record.value === undefined) {
    return DEFAULT_FOUNDER_BIOGRAPHY;
  }
  // Value is parsed from JSON by parseJsonValue, should be an array
  const biography = normalizeFounderBiography(record.value);
  return biography;
}

export async function saveFounderBiography(payload: FounderBiographyBlock[]): Promise<FounderBiographyBlock[]> {
  const sanitized = normalizeFounderBiography(payload);
  await upsertSiteSetting("founderBiography", sanitized);
  return sanitized;
}

export function normalizeFounderBiography(value: unknown): FounderBiographyBlock[] {
  // If value is null/undefined, return default
  if (value === null || value === undefined) {
    return DEFAULT_FOUNDER_BIOGRAPHY;
  }
  
  // Must be an array
  if (!Array.isArray(value)) {
    return DEFAULT_FOUNDER_BIOGRAPHY;
  }
  
  // If empty array, return default (can't have empty biography)
  if (value.length === 0) {
    return DEFAULT_FOUNDER_BIOGRAPHY;
  }
  
  const blocks = value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const source = item as Partial<FounderBiographyBlock>;
      const year = stringOrDefault(source.year, "");
      if (!year) {
        return null;
      }
      const lines = Array.isArray(source.lines)
        ? source.lines
            .map((line) => (typeof line === "string" && line.trim().length > 0 ? line.trim() : null))
            .filter((line): line is string => Boolean(line))
        : [];
      if (!lines.length) {
        return null;
      }
      return { year, lines };
    })
    .filter((item): item is FounderBiographyBlock => Boolean(item));

  // If no valid blocks after normalization, return default
  if (!blocks.length) {
    return DEFAULT_FOUNDER_BIOGRAPHY;
  }
  return blocks;
}

export async function getFounderLeadText(): Promise<string> {
  // Always read fresh to reflect admin changes immediately across the site
  // Force fresh read by using findSiteSettingByKey instead of fetchAllSiteSettings
  // Use direct key lookup to avoid any caching issues
  const record = await import("./site-settings-repository").then((m) => m.findSiteSettingByKey("founderLeadText"));
  if (!record) {
    return DEFAULT_FOUNDER_LEAD_TEXT;
  }
  
  // Value is parsed from JSON by parseJsonValue
  // If it was saved as a string, it should remain a string after JSON.parse
  // But MySQL JSON columns might return objects, so we need to handle that
  let text: string;
  
  // Check for null/undefined more carefully
  if (record.value == null) { // This checks both null and undefined
    return DEFAULT_FOUNDER_LEAD_TEXT;
  }
  
  if (typeof record.value === "string") {
    text = record.value.trim();
  } else if (typeof record.value === "object") {
    // If value is an object, it might be a parsed JSON string that was double-encoded
    // Or MySQL might have returned it as an object
    // Check if it's an empty object
    if (Object.keys(record.value).length === 0) {
      return DEFAULT_FOUNDER_LEAD_TEXT;
    }
    // Try to stringify and see if we can extract a string value
    const stringified = JSON.stringify(record.value);
    // If it's a JSON-encoded string, parse it
    try {
      const parsed = JSON.parse(stringified);
      if (typeof parsed === "string") {
        text = parsed.trim();
      } else {
        // If still not a string, try to convert
        text = stringified.trim();
      }
    } catch {
      text = stringified.trim();
    }
  } else {
    text = String(record.value).trim();
  }
  
  // Return text if not empty, otherwise default
  return text.length > 0 ? text : DEFAULT_FOUNDER_LEAD_TEXT;
}

export async function saveFounderLeadText(payload: string): Promise<string> {
  // Always save the actual payload, even if empty (allow empty strings)
  const sanitized = typeof payload === "string" ? payload.trim() : "";
  // Save the sanitized value (or empty string, not default)
  await upsertSiteSetting("founderLeadText", sanitized);
  // Return saved value or default if empty
  return sanitized || DEFAULT_FOUNDER_LEAD_TEXT;
}

export function invalidateSiteSettingsCache() {
  contactCache = null;
  socialCache = null;
  appearanceCache = null;
  publicationsCache = null;
}

