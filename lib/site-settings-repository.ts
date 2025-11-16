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
  const [result] = await runQuery((pool) =>
    pool.execute<ResultSetHeader>(
      `INSERT INTO SiteSetting (\`key\`, value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value), updatedAt = CURRENT_TIMESTAMP`,
      [key, JSON.stringify(value ?? null)],
    ),
  );
  try {
    console.log("[SiteSettingsRepo] upsertSiteSetting", {
      key,
      affectedRows: (result as ResultSetHeader)?.affectedRows,
    });
  } catch {}

  // Read raw DB value to verify persistence
  try {
    const [rows] = await runQuery((pool) =>
      pool.query<Array<{ value: unknown; updatedAt: Date }>>(
        "SELECT value, updatedAt FROM SiteSetting WHERE `key` = ? LIMIT 1",
        [key],
      ),
    );
    const raw = rows?.[0] ?? null;
    console.log("[SiteSettingsRepo] after-upsert raw", { key, raw });
  } catch {}

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
  return null;
}

