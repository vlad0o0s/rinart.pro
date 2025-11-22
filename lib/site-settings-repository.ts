import { ensureDatabaseSchema, ResultSetHeader, RowDataPacket, runQuery } from "./db";

export type SiteSettingRecord = {
  key: string;
  value: unknown;
  updatedAt: Date;
};

type SiteSettingRow = RowDataPacket & {
  key: string;
  value: unknown | null;
  updatedAt: Date;
};

export async function fetchAllSiteSettings(): Promise<SiteSettingRecord[]> {
  await ensureDatabaseSchema();
  const [rows] = await runQuery((pool) =>
    pool.query<SiteSettingRow[]>("SELECT `key`, value, updatedAt FROM SiteSetting"),
  );

  return rows.map((row) => ({
    key: row.key,
    value: parseJsonValue(row.value),
    updatedAt: row.updatedAt,
  }));
}

export async function findSiteSettingByKey(key: string): Promise<SiteSettingRecord | null> {
  await ensureDatabaseSchema();
  const [rows] = await runQuery((pool) =>
    pool.query<SiteSettingRow[]>("SELECT `key`, value, updatedAt FROM SiteSetting WHERE `key` = ? LIMIT 1", [key]),
  );
  if (!rows.length) {
    return null;
  }

  return {
    key: rows[0].key,
    value: parseJsonValue(rows[0].value),
    updatedAt: rows[0].updatedAt,
  };
}

export async function upsertSiteSetting(key: string, value: unknown): Promise<SiteSettingRecord> {
  await ensureDatabaseSchema();
  await runQuery((pool) =>
    pool.execute<ResultSetHeader>(
      `INSERT INTO SiteSetting (\`key\`, value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value), updatedAt = CURRENT_TIMESTAMP`,
      [key, JSON.stringify(value ?? null)],
    ),
  );

  const record = await findSiteSettingByKey(key);
  if (!record) {
    throw new Error(`Failed to load site setting with key "${key}" after upsert`);
  }
  return record;
}

function parseJsonValue(value: unknown): unknown {
  if (value === null || typeof value === "undefined") {
    return null;
  }
  // Some MySQL drivers may already hydrate JSON columns into objects/arrays
  if (typeof value === "object") {
    // If it's already an object or array, return it as-is
    // But check if it's a Buffer (MySQL might return JSON as Buffer)
    if (Buffer.isBuffer(value)) {
      try {
        const str = value.toString("utf8");
        const parsed = JSON.parse(str);
        return parsed;
      } catch {
        return null;
      }
    }
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    // Check if the string looks like JSON (starts with {, [, or " and is valid JSON)
    // If it's a JSON string (like "text"), parse it
    // If it's plain text, return it as-is
    try {
      const parsed = JSON.parse(trimmed);
      return parsed;
    } catch {
      // If parsing fails, it's likely plain text, not JSON
      // Return the original string instead of null
      return trimmed;
    }
  }
  return null;
}

