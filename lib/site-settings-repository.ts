import { ensureDatabaseSchema, ResultSetHeader, RowDataPacket, runQuery } from "./db";

export type SiteSettingRecord = {
  key: string;
  value: unknown;
  updatedAt: Date;
};

type SiteSettingRow = RowDataPacket & {
  key: string;
  value: string | null;
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

function parseJsonValue(value: string | null): unknown {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

