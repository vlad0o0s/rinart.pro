import { ensureDatabaseSchema, getPool, ResultSetHeader, RowDataPacket } from "./db";

export type MediaLibraryRecord = {
  id: number;
  url: string;
  title: string | null;
  createdAt: Date;
};

type MediaLibraryRow = RowDataPacket & {
  id: number;
  url: string;
  title: string | null;
  createdAt: Date;
};

function mapMediaRow(row: MediaLibraryRow): MediaLibraryRecord {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    createdAt: row.createdAt,
  };
}

export async function fetchMediaAssets(): Promise<MediaLibraryRecord[]> {
  await ensureDatabaseSchema();
  const [rows] = await getPool().query<MediaLibraryRow[]>(
    "SELECT id, url, title, createdAt FROM MediaAsset ORDER BY createdAt DESC, id DESC",
  );
  return rows.map(mapMediaRow);
}

export async function findMediaAssetByUrl(url: string): Promise<MediaLibraryRecord | null> {
  await ensureDatabaseSchema();
  const [rows] = await getPool().query<MediaLibraryRow[]>(
    "SELECT id, url, title, createdAt FROM MediaAsset WHERE url = ? LIMIT 1",
    [url],
  );
  if (!rows.length) {
    return null;
  }
  return mapMediaRow(rows[0]);
}

export async function createMediaAssetRecord(url: string, title?: string | null): Promise<MediaLibraryRecord> {
  await ensureDatabaseSchema();
  const existing = await findMediaAssetByUrl(url);
  if (existing) {
    if (title && !existing.title) {
      await getPool().execute("UPDATE MediaAsset SET title = ? WHERE id = ?", [title, existing.id]);
      return { ...existing, title };
    }
    return existing;
  }

  const [result] = await getPool().execute<ResultSetHeader>(
    "INSERT INTO MediaAsset (url, title) VALUES (?, ?)",
    [url, title ?? null],
  );

  const insertedId = Number(result.insertId);
  const [rows] = await getPool().query<MediaLibraryRow[]>(
    "SELECT id, url, title, createdAt FROM MediaAsset WHERE id = ? LIMIT 1",
    [insertedId],
  );
  if (!rows.length) {
    throw new Error("Failed to load media asset after insert");
  }
  return mapMediaRow(rows[0]);
}

export async function deleteMediaAssetById(id: number): Promise<void> {
  await ensureDatabaseSchema();
  await getPool().execute("DELETE FROM MediaAsset WHERE id = ?", [id]);
}

