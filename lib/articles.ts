/**
 * Раздел статей: типы, проверка и подготовка данных.
 *
 * Модуль без базы и без next — его вызывают роуты админки, страницы и тесты.
 * Статьи пишет и публикует бюро; здесь только правила, по которым их можно сохранить.
 */

import { SERVICE_PAGES } from "./services";

export const ARTICLES_PATH = "/stati";
/** Название раздела в меню и заголовке. Окончательное выбирает бюро. */
export const ARTICLES_LABEL = "Статьи";

export type ArticleStatus = "draft" | "published";

export type Article = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  bodyHtml: string;
  coverImageUrl: string | null;
  authorName: string;
  authorRole: string;
  status: ArticleStatus;
  /** ISO-дата публикации. У черновика может быть пустой. */
  publishedAt: string | null;
  /** ISO-дата последнего существенного обновления текста — её видит читатель и sitemap. */
  contentUpdatedAt: string | null;
  seoTitle: string;
  seoDescription: string;
  /** Адрес связанной услуги из SERVICE_PAGES, например «/proektirovanie». */
  servicePath: string | null;
  /** Адреса связанных проектов (slug). */
  relatedProjects: string[];
  updatedAt: string;
};

export type ArticleInput = Omit<Article, "id" | "updatedAt">;

/**
 * Адреса, которые статья занять не может: /stati/<slug> с ними не пересекается, но так
 * проще не перепутать статью с разделами сайта в отчётах.
 */
const RESERVED_SLUGS = new Set(["new", "admin", "api", "draft", "preview"]);

/** Адреса верхнего уровня, занятые разделами сайта: проект с таким slug был бы недоступен. */
export const RESERVED_TOP_LEVEL_SLUGS = new Set([
  "stati",
  "proektirovanie",
  "masterskaja",
  "kontakty",
  "privacy",
  "admin",
  "api",
  "lp",
  "uploads",
  "projects",
  "portfolio",
  "robots.txt",
  "sitemap.xml",
]);

const CYRILLIC_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l",
  м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh",
  щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/** Адрес из заголовка — по той же транслитерации, что и адреса проектов в админке. */
export function slugifyTitle(input: string): string {
  let result = "";
  for (const char of (input ?? "").toLowerCase()) {
    if (CYRILLIC_MAP[char] !== undefined) {
      result += CYRILLIC_MAP[char];
    } else if (/[a-z0-9]/.test(char)) {
      result += char;
    } else if (/\s|[_\-./]/.test(char)) {
      result += "-";
    }
  }
  return result.replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 120).replace(/-$/, "");
}

export function isValidArticleSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 120 && !RESERVED_SLUGS.has(slug);
}

/**
 * Очистка HTML статьи. Пишут в админке доверенные люди, но текст часто вставляют из чужих
 * документов: скрипты, стили, фреймы и обработчики событий на публичной странице не нужны.
 */
export function sanitizeArticleHtml(html: string): string {
  return (
    (html ?? "")
      // Элементы, содержимое которых не текст статьи, — вместе с содержимым.
      .replace(/<(script|style|iframe|object|textarea|select|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
      // Оставшиеся теги из того же ряда и одиночные — только сам тег.
      .replace(/<\/?(script|style|iframe|object|embed|form|input|button|textarea|select|noscript|template|meta|link|base)\b[^>]*>/gi, "")
      .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\s(href|src)\s*=\s*(?:"\s*(?:javascript|vbscript|data:text)[^"]*"|'\s*(?:javascript|vbscript|data:text)[^']*'|(?:javascript|vbscript|data:text)[^\s>]*)/gi, "")
      .replace(/\s(contenteditable|draggable)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .trim()
  );
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** Дата из формы (YYYY-MM-DD или ISO) в ISO; пустое или некорректное — null. */
export function parseDateInput(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? `${value.trim()}T09:00:00+03:00` : value.trim());
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export type ArticleValidation = { ok: true; value: ArticleInput } | { ok: false; errors: string[] };

/**
 * Проверка данных из формы. Черновик можно сохранить почти пустым; опубликовать — только
 * с заголовком, текстом и автором: у каждой статьи на сайте должен быть автор.
 */
export function validateArticleInput(raw: unknown, now: Date = new Date()): ArticleValidation {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const errors: string[] = [];

  const title = text(source.title, 200);
  const slug = typeof source.slug === "string" && source.slug.trim() ? source.slug.trim().toLowerCase() : slugifyTitle(title);
  const status: ArticleStatus = source.status === "published" ? "published" : "draft";
  const bodyHtml = sanitizeArticleHtml(typeof source.bodyHtml === "string" ? source.bodyHtml : "");
  const authorName = text(source.authorName, 120);
  const servicePath = typeof source.servicePath === "string" && SERVICE_PAGES.some((service) => service.path === source.servicePath)
    ? source.servicePath
    : null;
  const relatedProjects = Array.isArray(source.relatedProjects)
    ? [...new Set(source.relatedProjects.filter((item): item is string => typeof item === "string" && /^[a-z0-9-]+$/.test(item)))].slice(0, 6)
    : [];
  const coverImageUrl = typeof source.coverImageUrl === "string" && source.coverImageUrl.trim().startsWith("/uploads/")
    ? source.coverImageUrl.trim()
    : null;

  if (!title) errors.push("Нужен заголовок");
  if (!isValidArticleSlug(slug)) errors.push("Адрес статьи: только латиница, цифры и дефисы");
  if (bodyHtml.includes("data:image")) errors.push("Картинки в тексте должны быть загружены кнопкой IMG");

  if (status === "published") {
    const plain = bodyHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (plain.length < 300) errors.push("Для публикации нужен текст статьи — хотя бы несколько абзацев");
    if (!authorName) errors.push("Для публикации нужен автор");
  }

  if (errors.length) {
    return { ok: false, errors };
  }

  const publishedAt = parseDateInput(source.publishedAt) ?? (status === "published" ? now.toISOString() : null);

  return {
    ok: true,
    value: {
      slug,
      title,
      excerpt: text(source.excerpt, 400),
      bodyHtml,
      coverImageUrl,
      authorName,
      authorRole: text(source.authorRole, 120),
      status,
      publishedAt,
      contentUpdatedAt: parseDateInput(source.contentUpdatedAt),
      seoTitle: text(source.seoTitle, 200),
      seoDescription: text(source.seoDescription, 300),
      servicePath,
      relatedProjects,
    },
  };
}

/** Дата, которую видят читатель и sitemap: последнее существенное обновление или публикация. */
export function articleModifiedAt(article: Pick<Article, "publishedAt" | "contentUpdatedAt">): string | null {
  const published = article.publishedAt ? new Date(article.publishedAt).getTime() : NaN;
  const updated = article.contentUpdatedAt ? new Date(article.contentUpdatedAt).getTime() : NaN;
  if (Number.isFinite(updated) && (!Number.isFinite(published) || updated > published)) {
    return article.contentUpdatedAt;
  }
  return article.publishedAt;
}

const dateFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Moscow" });

export function formatArticleDate(iso: string | null): string {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : dateFormat.format(date);
}
