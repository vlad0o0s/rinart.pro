import { ensureDatabaseSchema, ResultSetHeader, RowDataPacket, runQuery } from "./db";

export type GlobalBlockRecord = {
  slug: string;
  data: unknown;
  updatedAt: Date;
};

type GlobalBlockRow = RowDataPacket & {
  slug: string;
  data: unknown | null;
  updatedAt: Date;
};

export async function fetchAllGlobalBlocks(): Promise<GlobalBlockRecord[]> {
  await ensureDatabaseSchema();
  const [rows] = await runQuery((pool) =>
    pool.query<GlobalBlockRow[]>("SELECT slug, data, updatedAt FROM GlobalBlock"),
  );
  return rows.map((row) => ({
    slug: row.slug,
    data: parseJsonValue(row.data),
    updatedAt: row.updatedAt,
  }));
}

export async function findGlobalBlockBySlug(slug: string): Promise<GlobalBlockRecord | null> {
  await ensureDatabaseSchema();
  const [rows] = await runQuery((pool) =>
    pool.query<GlobalBlockRow[]>("SELECT slug, data, updatedAt FROM GlobalBlock WHERE slug = ? LIMIT 1", [slug]),
  );
  if (!rows.length) {
    return null;
  }
  return {
    slug: rows[0].slug,
    data: parseJsonValue(rows[0].data),
    updatedAt: rows[0].updatedAt,
  };
}

export async function upsertGlobalBlock(slug: string, data: unknown): Promise<GlobalBlockRecord> {
  await ensureDatabaseSchema();
  await runQuery((pool) =>
    pool.execute<ResultSetHeader>(
      `INSERT INTO GlobalBlock (slug, data)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE data = VALUES(data), updatedAt = CURRENT_TIMESTAMP`,
      [slug, JSON.stringify(data ?? null)],
    ),
  );
  const record = await findGlobalBlockBySlug(slug);
  if (!record) {
    throw new Error(`Failed to load global block with slug "${slug}" after upsert`);
  }
  return record;
}

function parseJsonValue(value: unknown): unknown {
  if (value === null || typeof value === "undefined") {
    return null;
  }
  // Some MySQL drivers may already hydrate JSON columns into objects
  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  // Fallback: unsupported type
  return null;
}


