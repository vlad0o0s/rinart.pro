import { ensureDatabaseSchema, ResultSetHeader, RowDataPacket, runQuery, withTransaction } from "./db";

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
  const [rows] = await runQuery((pool) =>
    pool.query<MediaLibraryRow[]>(
      "SELECT id, url, title, createdAt FROM MediaAsset ORDER BY createdAt DESC, id DESC",
    ),
  );
  return rows.map(mapMediaRow);
}

export async function findMediaAssetByUrl(url: string): Promise<MediaLibraryRecord | null> {
  await ensureDatabaseSchema();
  const [rows] = await runQuery((pool) =>
    pool.query<MediaLibraryRow[]>(
      "SELECT id, url, title, createdAt FROM MediaAsset WHERE url = ? LIMIT 1",
      [url],
    ),
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
      await runQuery((pool) => pool.execute("UPDATE MediaAsset SET title = ? WHERE id = ?", [title, existing.id]));
      return { ...existing, title };
    }
    return existing;
  }

  const [result] = await runQuery((pool) =>
    pool.execute<ResultSetHeader>("INSERT INTO MediaAsset (url, title) VALUES (?, ?)", [url, title ?? null]),
  );

  const insertedId = Number(result.insertId);
  const [rows] = await runQuery((pool) =>
    pool.query<MediaLibraryRow[]>(
      "SELECT id, url, title, createdAt FROM MediaAsset WHERE id = ? LIMIT 1",
      [insertedId],
    ),
  );
  if (!rows.length) {
    throw new Error("Failed to load media asset after insert");
  }
  return mapMediaRow(rows[0]);
}

export async function deleteMediaAssetById(id: number): Promise<void> {
  await ensureDatabaseSchema();
  // Сначала получаем URL перед удалением записи
  const [rows] = await runQuery((pool) =>
    pool.query<MediaLibraryRow[]>("SELECT url FROM MediaAsset WHERE id = ? LIMIT 1", [id]),
  );
  const url = rows.length ? rows[0].url : null;

  await runQuery((pool) => pool.execute("DELETE FROM MediaAsset WHERE id = ?", [id]));

  // Удаляем все ссылки на это изображение из всех мест
  if (url) {
    await removeImageReferencesFromAllPlaces(url);
  }
}

/**
 * Удаляет все ссылки на изображение из всех мест в базе данных
 */
export async function removeImageReferencesFromAllPlaces(imageUrl: string): Promise<void> {
  await ensureDatabaseSchema();

  await withTransaction(async (connection) => {
    // 1. Удаляем из Project.heroImageUrl
    await connection.execute("UPDATE Project SET heroImageUrl = NULL WHERE heroImageUrl = ?", [imageUrl]);

    // 2. Удаляем из ProjectMedia (галерея, схемы)
    await connection.execute("DELETE FROM ProjectMedia WHERE url = ?", [imageUrl]);

    // 3. Удаляем из ProjectScheme
    await connection.execute("DELETE FROM ProjectScheme WHERE url = ?", [imageUrl]);

    // 4. Удаляем из Project.content (JSON) - seo.ogImage
    const [projectRows] = await connection.query<RowDataPacket[]>(
      "SELECT id, content FROM Project WHERE content IS NOT NULL",
    );

    for (const row of projectRows) {
      if (!row.content) continue;

      let content: unknown;
      try {
        content = typeof row.content === "string" ? JSON.parse(row.content) : row.content;
      } catch {
        continue;
      }

      if (!content || typeof content !== "object") continue;

      const contentObj = content as Record<string, unknown>;
      const seo = contentObj.seo as Record<string, unknown> | undefined;

      if (seo && typeof seo === "object" && seo.ogImage === imageUrl) {
        delete seo.ogImage;
        // Если ogImage был единственным полем в seo, можно оставить пустой объект
        await connection.execute("UPDATE Project SET content = ? WHERE id = ?", [
          JSON.stringify(contentObj),
          row.id,
        ]);
      }
    }

    // 5. Удаляем из PageSeo.ogImageUrl
    await connection.execute("UPDATE PageSeo SET ogImageUrl = NULL WHERE ogImageUrl = ?", [imageUrl]);

    // 6. Удаляем из GlobalBlock (home-hero, page-transition)
    const [globalBlockRows] = await connection.query<RowDataPacket[]>(
      "SELECT slug, data FROM GlobalBlock WHERE slug IN ('home-hero', 'page-transition')",
    );

    for (const row of globalBlockRows) {
      if (!row.data) continue;

      let data: unknown;
      try {
        data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
      } catch {
        continue;
      }

      if (!data || typeof data !== "object") continue;

      const dataObj = data as Record<string, unknown>;
      if (dataObj.imageUrl === imageUrl) {
        dataObj.imageUrl = null;
        await connection.execute("UPDATE GlobalBlock SET data = ? WHERE slug = ?", [
          JSON.stringify(dataObj),
          row.slug,
        ]);
      }
    }

    // 7. Удаляем из TeamMember.imageUrl и mobileImageUrl
    await connection.execute("UPDATE TeamMember SET imageUrl = NULL WHERE imageUrl = ?", [imageUrl]);
    await connection.execute("UPDATE TeamMember SET mobileImageUrl = NULL WHERE mobileImageUrl = ?", [imageUrl]);
  });
}

