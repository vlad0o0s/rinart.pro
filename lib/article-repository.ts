import { ensureDatabaseSchema, runQuery, type ResultSetHeader, type RowDataPacket } from "./db";
import type { Article, ArticleInput, ArticleStatus } from "./articles";

type ArticleRow = RowDataPacket & {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  bodyHtml: string | null;
  coverImageUrl: string | null;
  authorName: string | null;
  authorRole: string | null;
  status: ArticleStatus;
  publishedAt: Date | null;
  contentUpdatedAt: Date | null;
  seoTitle: string | null;
  seoDescription: string | null;
  servicePath: string | null;
  relatedProjects: unknown;
  updatedAt: Date;
};

const COLUMNS =
  "id, slug, title, excerpt, bodyHtml, coverImageUrl, authorName, authorRole, status, publishedAt, contentUpdatedAt, seoTitle, seoDescription, servicePath, relatedProjects, updatedAt";

function toIso(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseSlugs(value: unknown): string[] {
  const parsed = typeof value === "string" ? safeJson(value) : value;
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function mapRow(row: ArticleRow): Article {
  return {
    id: Number(row.id),
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt ?? "",
    bodyHtml: row.bodyHtml ?? "",
    coverImageUrl: row.coverImageUrl,
    authorName: row.authorName ?? "",
    authorRole: row.authorRole ?? "",
    status: row.status === "published" ? "published" : "draft",
    publishedAt: toIso(row.publishedAt),
    contentUpdatedAt: toIso(row.contentUpdatedAt),
    seoTitle: row.seoTitle ?? "",
    seoDescription: row.seoDescription ?? "",
    servicePath: row.servicePath,
    relatedProjects: parseSlugs(row.relatedProjects),
    updatedAt: toIso(row.updatedAt) ?? new Date(0).toISOString(),
  };
}

/** Дата для DATETIME: MySQL не принимает ISO с «Z», поэтому передаём объект Date. */
function toDbDate(iso: string | null): Date | null {
  return iso ? new Date(iso) : null;
}

/**
 * Опубликованные статьи держим в памяти минуту, как проекты: база на хостинге с жёстким
 * лимитом соединений, а список статей нужен меню на каждой странице.
 *
 * Кеш лежит в globalThis: страницы и роуты админки Next собирает в разные слои со своими
 * копиями модуля, и сброс из админки иначе не доходил бы до страниц — опубликованная
 * статья появлялась бы на сайте только через минуту.
 */
const CACHE_TTL_MS = 60_000;
const cacheHolder = globalThis as typeof globalThis & {
  __rinartPublishedArticles?: { value: Article[]; expires: number } | null;
};

export function invalidateArticlesCache() {
  cacheHolder.__rinartPublishedArticles = null;
}

/** Опубликованные статьи, свежие сверху. Статья с датой публикации в будущем ещё не видна. */
export async function getPublishedArticles(): Promise<Article[]> {
  const publishedCache = cacheHolder.__rinartPublishedArticles;
  if (publishedCache && publishedCache.expires > Date.now()) {
    return publishedCache.value;
  }
  await ensureDatabaseSchema();
  const [rows] = await runQuery((pool) =>
    pool.query<ArticleRow[]>(`SELECT ${COLUMNS} FROM Article WHERE status = 'published' ORDER BY publishedAt DESC, id DESC`),
  );
  // Дату сравниваем здесь, а не через NOW(): у базы на хостинге свой часовой пояс.
  const now = Date.now();
  const value = rows
    .map(mapRow)
    .filter((article) => !article.publishedAt || new Date(article.publishedAt).getTime() <= now);
  cacheHolder.__rinartPublishedArticles = { value, expires: now + CACHE_TTL_MS };
  return value;
}

/** Есть ли что показать в разделе. Ошибка базы не должна ронять меню на всех страницах. */
export async function hasPublishedArticles(): Promise<boolean> {
  try {
    return (await getPublishedArticles()).length > 0;
  } catch (error) {
    console.error("[articles] failed to read published articles", error);
    return false;
  }
}

export async function getPublishedArticleBySlug(slug: string): Promise<Article | null> {
  return (await getPublishedArticles()).find((article) => article.slug === slug) ?? null;
}

/** Для админки и предпросмотра черновика — без кеша. */
export async function fetchArticleBySlug(slug: string): Promise<Article | null> {
  await ensureDatabaseSchema();
  const [rows] = await runQuery((pool) => pool.query<ArticleRow[]>(`SELECT ${COLUMNS} FROM Article WHERE slug = ? LIMIT 1`, [slug]));
  return rows.length ? mapRow(rows[0]) : null;
}

export async function fetchArticleById(id: number): Promise<Article | null> {
  await ensureDatabaseSchema();
  const [rows] = await runQuery((pool) => pool.query<ArticleRow[]>(`SELECT ${COLUMNS} FROM Article WHERE id = ? LIMIT 1`, [id]));
  return rows.length ? mapRow(rows[0]) : null;
}

export async function fetchAllArticles(): Promise<Article[]> {
  await ensureDatabaseSchema();
  const [rows] = await runQuery((pool) =>
    pool.query<ArticleRow[]>(`SELECT ${COLUMNS} FROM Article ORDER BY (status = 'draft') DESC, COALESCE(publishedAt, updatedAt) DESC, id DESC`),
  );
  return rows.map(mapRow);
}

function writeValues(input: ArticleInput) {
  return [
    input.slug,
    input.title,
    input.excerpt || null,
    input.bodyHtml || null,
    input.coverImageUrl,
    input.authorName || null,
    input.authorRole || null,
    input.status,
    toDbDate(input.publishedAt),
    toDbDate(input.contentUpdatedAt),
    input.seoTitle || null,
    input.seoDescription || null,
    input.servicePath,
    JSON.stringify(input.relatedProjects),
  ];
}

export async function createArticle(input: ArticleInput): Promise<Article> {
  await ensureDatabaseSchema();
  const [result] = await runQuery((pool) =>
    pool.query<ResultSetHeader>(
      `INSERT INTO Article (slug, title, excerpt, bodyHtml, coverImageUrl, authorName, authorRole, status, publishedAt, contentUpdatedAt, seoTitle, seoDescription, servicePath, relatedProjects)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      writeValues(input),
    ),
  );
  invalidateArticlesCache();
  const created = await fetchArticleById(result.insertId);
  if (!created) {
    throw new Error("Статья не сохранилась");
  }
  return created;
}

export async function updateArticle(id: number, input: ArticleInput): Promise<Article | null> {
  await ensureDatabaseSchema();
  await runQuery((pool) =>
    pool.query<ResultSetHeader>(
      `UPDATE Article SET slug = ?, title = ?, excerpt = ?, bodyHtml = ?, coverImageUrl = ?, authorName = ?, authorRole = ?, status = ?,
         publishedAt = ?, contentUpdatedAt = ?, seoTitle = ?, seoDescription = ?, servicePath = ?, relatedProjects = ?
       WHERE id = ?`,
      [...writeValues(input), id],
    ),
  );
  invalidateArticlesCache();
  return fetchArticleById(id);
}

export async function deleteArticle(id: number): Promise<void> {
  await ensureDatabaseSchema();
  await runQuery((pool) => pool.query<ResultSetHeader>("DELETE FROM Article WHERE id = ?", [id]));
  invalidateArticlesCache();
}

export async function isArticleSlugTaken(slug: string, exceptId?: number): Promise<boolean> {
  await ensureDatabaseSchema();
  const [rows] = await runQuery((pool) =>
    pool.query<RowDataPacket[]>("SELECT id FROM Article WHERE slug = ? AND id <> ? LIMIT 1", [slug, exceptId ?? 0]),
  );
  return rows.length > 0;
}
