import { ensureDatabaseSchema, ResultSetHeader, RowDataPacket, runQuery } from "./db";

export type PageSeoRecord = {
  slug: string;
  title: string | null;
  description: string | null;
  keywords: string[];
  ogImageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PageSeoRow = RowDataPacket & {
  slug: string;
  title: string | null;
  description: string | null;
  keywords: string | null;
  ogImageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function parseKeywords(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0);
    }

    if (typeof parsed === "string" && parsed.trim().length > 0) {
      return parsed
        .split(",")
        .map((keyword) => keyword.trim())
        .filter((keyword) => keyword.length > 0);
    }
  } catch {
    // fall back to comma separated string
  }

  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0);
}

function mapRow(row: PageSeoRow): PageSeoRecord {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    keywords: parseKeywords(row.keywords),
    ogImageUrl: row.ogImageUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function fetchAllPageSeo(): Promise<PageSeoRecord[]> {
  await ensureDatabaseSchema();
  const [rows] = await runQuery((pool) =>
    pool.query<PageSeoRow[]>(
      "SELECT slug, title, description, keywords, ogImageUrl, createdAt, updatedAt FROM PageSeo ORDER BY slug",
    ),
  );
  return rows.map(mapRow);
}

export async function findPageSeoBySlug(slug: string): Promise<PageSeoRecord | null> {
  await ensureDatabaseSchema();
  const [rows] = await runQuery((pool) =>
    pool.query<PageSeoRow[]>(
      "SELECT slug, title, description, keywords, ogImageUrl, createdAt, updatedAt FROM PageSeo WHERE slug = ? LIMIT 1",
      [slug],
    ),
  );
  if (!rows.length) {
    return null;
  }
  return mapRow(rows[0]);
}

export async function upsertPageSeo(params: {
  slug: string;
  title?: string | null;
  description?: string | null;
  keywords?: string[];
  ogImageUrl?: string | null;
}): Promise<PageSeoRecord> {
  const normalisedKeywords = Array.isArray(params.keywords)
    ? params.keywords
        .map((keyword) => (typeof keyword === "string" ? keyword.trim() : ""))
        .filter((keyword) => keyword.length > 0)
    : [];

  const payload = {
    slug: params.slug,
    title: params.title ?? null,
    description: params.description ?? null,
    keywords: normalisedKeywords,
    ogImageUrl: params.ogImageUrl ?? null,
  };

  await ensureDatabaseSchema();
  await runQuery((pool) =>
    pool.execute<ResultSetHeader>(
      `INSERT INTO PageSeo (slug, title, description, keywords, ogImageUrl)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), keywords = VALUES(keywords), ogImageUrl = VALUES(ogImageUrl)`,
      [
        payload.slug,
        payload.title,
        payload.description,
        payload.keywords.length ? JSON.stringify(payload.keywords) : null,
        payload.ogImageUrl,
      ],
    ),
  );

  const record = await findPageSeoBySlug(payload.slug);
  if (!record) {
    throw new Error("Failed to load SEO record after upsert");
  }
  return record;
}


