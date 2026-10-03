import { findGlobalBlockBySlug, upsertGlobalBlock } from "./global-blocks-repository";
import {
  ARTICLE_LEAD_MODAL_DEFAULTS,
  sanitizeArticleLeadModalSettings,
  type ArticleLeadModalSettings,
} from "./article-lead-modal";

/**
 * Настройки окна заявки лежат в таблице глобальных блоков — отдельной записью, которую
 * остальной код блоков не читает. Новых таблиц и колонок для них не нужно.
 */
const BLOCK_SLUG = "article-lead-modal";

/**
 * Настройки нужны каждой странице статьи, а база — на хостинге с жёстким лимитом
 * соединений, поэтому минуту держим их в памяти. Кеш в globalThis по той же причине,
 * что и у статей: страницы и роуты админки Next собирает со своими копиями модуля,
 * и сброс из админки иначе не дошёл бы до страниц.
 */
const CACHE_TTL_MS = 60_000;
const cacheHolder = globalThis as typeof globalThis & {
  __rinartArticleLeadModal?: { value: ArticleLeadModalSettings; expires: number } | null;
};

/** Сбой базы не должен ронять статью: читатель увидит окно с текстами по умолчанию. */
export async function getArticleLeadModalSettings(): Promise<ArticleLeadModalSettings> {
  const cached = cacheHolder.__rinartArticleLeadModal;
  if (cached && cached.expires > Date.now()) {
    return cached.value;
  }
  try {
    const record = await findGlobalBlockBySlug(BLOCK_SLUG);
    const value = sanitizeArticleLeadModalSettings(record?.data);
    cacheHolder.__rinartArticleLeadModal = { value, expires: Date.now() + CACHE_TTL_MS };
    return value;
  } catch (error) {
    console.error("[articles] failed to read lead modal settings", error);
    return ARTICLE_LEAD_MODAL_DEFAULTS;
  }
}

export async function saveArticleLeadModalSettings(raw: unknown): Promise<ArticleLeadModalSettings> {
  const value = sanitizeArticleLeadModalSettings(raw);
  await upsertGlobalBlock(BLOCK_SLUG, value);
  cacheHolder.__rinartArticleLeadModal = null;
  return value;
}
