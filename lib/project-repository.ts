import {
  withTransaction,
  PoolConnection,
  RowDataPacket,
  ResultSetHeader,
  ensureDatabaseSchema,
  runQuery,
} from "./db";

export type ProjectMediaKind = "FEATURE" | "GALLERY" | "SCHEME";

type Fact = { label: string; value: string };
export type ProjectSeo = {
  title?: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
};
export type ProjectContent = {
  body?: string[];
  bodyHtml?: string;
  facts?: Fact[];
  seo?: ProjectSeo;
} | null;

export type ProjectRecord = {
  id: number;
  slug: string;
  title: string;
  tagline: string | null;
  location: string | null;
  year: string | null;
  area: string | null;
  scope: string | null;
  intro: string | null;
  heroImageUrl: string | null;
  order: number;
  categories: string[];
  content: ProjectContent;
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectMediaRecord = {
  id: number;
  projectId: number;
  url: string;
  caption: string | null;
  kind: ProjectMediaKind;
  order: number;
  createdAt: Date;
};

export type ProjectSchemeRecord = {
  id: number;
  projectId: number;
  title: string;
  url: string;
  order: number;
  createdAt: Date;
};

export type ProjectDetailRecord = ProjectRecord & {
  media: ProjectMediaRecord[];
  schemes: ProjectSchemeRecord[];
};

type ProjectRow = RowDataPacket & {
  id: number;
  slug: string;
  title: string;
  tagline: string | null;
  location: string | null;
  year: string | null;
  area: string | null;
  scope: string | null;
  intro: string | null;
  heroImageUrl: string | null;
  order: number;
  categories: string | null;
  content: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ProjectMediaRow = RowDataPacket & {
  id: number;
  projectId: number;
  url: string;
  caption: string | null;
  kind: ProjectMediaKind;
  order: number;
  createdAt: Date;
};

type ProjectSchemeRow = RowDataPacket & {
  id: number;
  projectId: number;
  title: string;
  url: string;
  order: number;
  createdAt: Date;
};

function parseJsonValue<T>(value: string | null | Record<string, unknown>, fallback: T, opts?: { silent?: boolean }): T {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === "object") {
    return value as T;
  }

  const raw = typeof value === "string" ? value : String(value);
  if (!raw.trim()) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    if (!opts?.silent) {
      console.warn("Failed to parse JSON column", error);
    }
    return fallback;
  }
}

function parseStringArrayColumn(value: string | null): string[] {
  if (!value) {
    return [];
  }
  const raw = typeof value === "string" ? value : String(value);
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }
  if (trimmed.startsWith("[") || trimmed.startsWith("{") || trimmed.startsWith("\"")) {
    const parsed = parseJsonValue<string[] | string>(trimmed, [], { silent: true });
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    }
    if (typeof parsed === "string") {
      return parsed
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    }
  }
  return trimmed
    .split(",")
    .map((part) => {
      const text = typeof part === "string" ? part : String(part);
      return text.trim();
    })
    .filter((part) => part.length > 0);
}

function normaliseSeoValue(value: unknown): ProjectSeo | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const source = value as { title?: unknown; description?: unknown; keywords?: unknown; ogImage?: unknown };
  const title = typeof source.title === "string" ? source.title.trim() : "";
  const description = typeof source.description === "string" ? source.description.trim() : "";
  let keywords: string[] = [];
  if (Array.isArray(source.keywords)) {
    keywords = source.keywords
      .map((keyword) => (typeof keyword === "string" ? keyword.trim() : ""))
      .filter((keyword) => keyword.length > 0);
  } else if (typeof source.keywords === "string") {
    keywords = source.keywords
      .split(",")
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword.length > 0);
  }
  const ogImage = typeof source.ogImage === "string" ? source.ogImage.trim() : "";

  const result: ProjectSeo = {};
  if (title) result.title = title;
  if (description) result.description = description;
  if (keywords.length) result.keywords = keywords;
  if (ogImage) result.ogImage = ogImage;
  if (!Object.keys(result).length) {
    return undefined;
  }
  return result;
}

function normaliseProjectContent(content: ProjectContent): ProjectContent {
  if (!content) {
    return null;
  }
  const normalized: NonNullable<ProjectContent> = { ...content };

  if (Array.isArray(normalized.body)) {
    const cleanedBody = normalized.body
      .map((paragraph) => (typeof paragraph === "string" ? paragraph.trim() : ""))
      .filter((paragraph) => paragraph.length > 0);
    if (cleanedBody.length) {
      normalized.body = cleanedBody;
    } else {
      delete normalized.body;
    }
  }

  if (typeof normalized.bodyHtml === "string") {
    const trimmedHtml = normalized.bodyHtml.trim();
    if (trimmedHtml) {
      normalized.bodyHtml = trimmedHtml;
    } else {
      delete normalized.bodyHtml;
    }
  }

  if (Array.isArray(normalized.facts)) {
    const cleanedFacts = normalized.facts
      .map((fact) => {
        if (!fact || typeof fact.label !== "string" || typeof fact.value !== "string") {
          return null;
        }
        const label = fact.label.trim();
        const value = fact.value.trim();
        if (!label && !value) {
          return null;
        }
        return { label, value };
      })
      .filter((fact): fact is Fact => Boolean(fact));
    if (cleanedFacts.length) {
      normalized.facts = cleanedFacts;
    } else {
      delete normalized.facts;
    }
  }

  const seo = normaliseSeoValue(content.seo);
  if (seo) {
    normalized.seo = seo;
  } else {
    delete normalized.seo;
  }

  if (!normalized.body && !normalized.bodyHtml && !normalized.facts && !normalized.seo) {
    return null;
  }

  return normalized;
}

function mapProjectRow(row: ProjectRow): ProjectRecord {
  const rawContent = parseJsonValue<ProjectContent>(row.content, null);
  const content = normaliseProjectContent(rawContent);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    tagline: row.tagline,
    location: row.location,
    year: row.year,
    area: row.area,
    scope: row.scope,
    intro: row.intro,
    heroImageUrl: row.heroImageUrl,
    order: row.order,
    categories: parseStringArrayColumn(row.categories),
    content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapMediaRow(row: ProjectMediaRow): ProjectMediaRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    url: row.url,
    caption: row.caption,
    kind: row.kind,
    order: row.order,
    createdAt: row.createdAt,
  };
}

function mapSchemeRow(row: ProjectSchemeRow): ProjectSchemeRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    url: row.url,
    order: row.order,
    createdAt: row.createdAt,
  };
}

export async function fetchAllProjects(): Promise<ProjectRecord[]> {
  await ensureDatabaseSchema();
  const [rows] = await runQuery((pool) =>
    pool.query<ProjectRow[]>(
      "SELECT id, slug, title, tagline, location, year, area, scope, intro, heroImageUrl, `order`, categories, content, createdAt, updatedAt FROM Project ORDER BY `order` ASC, id ASC",
    ),
  );
  return rows.map(mapProjectRow);
}

export async function fetchAllProjectsWithRelations(): Promise<ProjectDetailRecord[]> {
  await ensureDatabaseSchema();
  const projects = await fetchAllProjects();
  if (!projects.length) {
    return [];
  }

  const ids = projects.map((project) => project.id);

  const placeholders = ids.map(() => "?").join(", ");

  const [mediaRows] = await runQuery((pool) =>
    pool.query<ProjectMediaRow[]>(
      `SELECT id, projectId, url, caption, kind, \`order\`, createdAt
       FROM ProjectMedia
       WHERE projectId IN (${placeholders})
       ORDER BY projectId ASC, \`order\` ASC, id ASC`,
      ids,
    ),
  );

  const [schemeRows] = await runQuery((pool) =>
    pool.query<ProjectSchemeRow[]>(
      `SELECT id, projectId, title, url, \`order\`, createdAt
       FROM ProjectScheme
       WHERE projectId IN (${placeholders})
       ORDER BY projectId ASC, \`order\` ASC, id ASC`,
      ids,
    ),
  );

  const mediaMap = new Map<number, ProjectMediaRecord[]>();
  mediaRows.forEach((row) => {
    const list = mediaMap.get(row.projectId) ?? [];
    list.push(mapMediaRow(row));
    mediaMap.set(row.projectId, list);
  });

  const schemeMap = new Map<number, ProjectSchemeRecord[]>();
  schemeRows.forEach((row) => {
    const list = schemeMap.get(row.projectId) ?? [];
    list.push(mapSchemeRow(row));
    schemeMap.set(row.projectId, list);
  });

  return projects.map((project) => ({
    ...project,
    media: mediaMap.get(project.id) ?? [],
    schemes: schemeMap.get(project.id) ?? [],
  }));
}

export async function fetchProjectBySlugWithRelations(slug: string): Promise<ProjectDetailRecord | null> {
  await ensureDatabaseSchema();
  const [rows] = await runQuery((pool) =>
    pool.query<ProjectRow[]>(
      "SELECT id, slug, title, tagline, location, year, area, scope, intro, heroImageUrl, `order`, categories, content, createdAt, updatedAt FROM Project WHERE slug = ? LIMIT 1",
      [slug],
    ),
  );
  if (!rows.length) {
    return null;
  }
  const project = mapProjectRow(rows[0]);

  const [mediaRows] = await runQuery((pool) =>
    pool.query<ProjectMediaRow[]>(
      "SELECT id, projectId, url, caption, kind, `order`, createdAt FROM ProjectMedia WHERE projectId = ? ORDER BY `order` ASC, id ASC",
      [project.id],
    ),
  );

  const [schemeRows] = await runQuery((pool) =>
    pool.query<ProjectSchemeRow[]>(
      "SELECT id, projectId, title, url, `order`, createdAt FROM ProjectScheme WHERE projectId = ? ORDER BY `order` ASC, id ASC",
      [project.id],
    ),
  );

  return {
    ...project,
    media: mediaRows.map(mapMediaRow),
    schemes: schemeRows.map(mapSchemeRow),
  };
}

export async function fetchProjectIdBySlug(slug: string): Promise<number | null> {
  await ensureDatabaseSchema();
  const [rows] = await runQuery((pool) => pool.query<RowDataPacket[]>("SELECT id FROM Project WHERE slug = ? LIMIT 1", [slug]));
  if (!rows.length) {
    return null;
  }
  return Number(rows[0].id);
}

export type ProjectWriteData = {
  slug: string;
  title: string;
  tagline: string | null;
  location: string | null;
  year: string | null;
  area: string | null;
  scope: string | null;
  intro: string | null;
  heroImageUrl: string | null;
  order: number;
  categories: string[];
  content: ProjectContent;
};

export async function createProject(data: ProjectWriteData): Promise<ProjectDetailRecord> {
  return withTransaction(async (connection) => {
    const payload = buildProjectInsertPayload(data);
    const [result] = await connection.execute<ResultSetHeader>(
      "INSERT INTO Project (slug, title, tagline, location, year, area, scope, intro, heroImageUrl, `order`, categories, content) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      payload,
    );

    const insertedId = result.insertId;
    const project = await fetchProjectByIdWithRelations(insertedId, connection);
    if (!project) {
      throw new Error("Failed to load project after insert");
    }
    return project;
  });
}

export async function updateProjectBySlug(slug: string, updates: Partial<ProjectWriteData>): Promise<ProjectDetailRecord> {
  if (!Object.keys(updates).length) {
    const current = await fetchProjectBySlugWithRelations(slug);
    if (!current) {
      throw new Error("Project not found");
    }
    return current;
  }

  return withTransaction(async (connection) => {
    const [currentRows] = await connection.query<ProjectRow[]>(
      "SELECT id, slug, title, tagline, location, year, area, scope, intro, heroImageUrl, `order`, categories, content, createdAt, updatedAt FROM Project WHERE slug = ? LIMIT 1",
      [slug],
    );
    if (!currentRows.length) {
      throw new Error("Project not found");
    }
    const current = mapProjectRow(currentRows[0]);

    const statements: string[] = [];
    const values: unknown[] = [];

    if (updates.slug !== undefined) {
      statements.push("slug = ?");
      values.push(updates.slug);
    }
    if (updates.title !== undefined) {
      statements.push("title = ?");
      values.push(updates.title);
    }
    if (updates.tagline !== undefined) {
      statements.push("tagline = ?");
      values.push(updates.tagline);
    }
    if (updates.location !== undefined) {
      statements.push("location = ?");
      values.push(updates.location);
    }
    if (updates.year !== undefined) {
      statements.push("year = ?");
      values.push(updates.year);
    }
    if (updates.area !== undefined) {
      statements.push("area = ?");
      values.push(updates.area);
    }
    if (updates.scope !== undefined) {
      statements.push("scope = ?");
      values.push(updates.scope);
    }
    if (updates.intro !== undefined) {
      statements.push("intro = ?");
      values.push(updates.intro);
    }
    if (updates.heroImageUrl !== undefined) {
      statements.push("heroImageUrl = ?");
      values.push(updates.heroImageUrl);
    }
    if (updates.order !== undefined) {
      statements.push("`order` = ?");
      values.push(updates.order);
    }
    if (updates.categories !== undefined) {
      statements.push("categories = ?");
      values.push(JSON.stringify(updates.categories ?? []));
    }
    if (updates.content !== undefined) {
      statements.push("content = ?");
      const normalizedContent = normaliseProjectContent(updates.content);
      values.push(normalizedContent ? JSON.stringify(normalizedContent) : null);
    }

    if (statements.length) {
      values.push(slug);
      await connection.execute(`UPDATE Project SET ${statements.join(", ")} WHERE slug = ? LIMIT 1`, values);
    }

    const project = await fetchProjectByIdWithRelations(current.id, connection);
    if (!project) {
      throw new Error("Project not found after update");
    }
    return project;
  });
}

export async function deleteProjectBySlug(slug: string): Promise<void> {
  await withTransaction(async (connection) => {
    const [rows] = await connection.query<RowDataPacket[]>("SELECT id FROM Project WHERE slug = ? LIMIT 1", [slug]);
    if (!rows.length) {
      return;
    }
    const id = Number(rows[0].id);
    await connection.execute("DELETE FROM ProjectMedia WHERE projectId = ?", [id]);
    await connection.execute("DELETE FROM ProjectScheme WHERE projectId = ?", [id]);
    await connection.execute("DELETE FROM Project WHERE id = ?", [id]);
  });
}

export async function reorderProjects(order: string[]): Promise<void> {
  if (!order.length) {
    return;
  }
  await withTransaction(async (connection) => {
    for (let index = 0; index < order.length; index += 1) {
      await connection.execute("UPDATE Project SET `order` = ? WHERE slug = ?", [index, order[index]]);
    }
  });
}

export type ReplaceMediaPayload = {
  projectSlug: string;
  featureImageUrl?: string | null;
  gallery: {
    url: string;
    caption?: string | null;
    order?: number;
  }[];
  schemes: {
    url: string;
    title?: string | null;
    order?: number;
  }[];
};

export async function replaceProjectMedia(payload: ReplaceMediaPayload): Promise<void> {
  await withTransaction(async (connection) => {
    const project = await fetchProjectBySlugForTransaction(payload.projectSlug, connection);
    if (!project) {
      throw new Error("Project not found");
    }

    await connection.execute("DELETE FROM ProjectMedia WHERE projectId = ?", [project.id]);
    await connection.execute("DELETE FROM ProjectScheme WHERE projectId = ?", [project.id]);

    if (payload.featureImageUrl !== undefined) {
      await connection.execute("UPDATE Project SET heroImageUrl = ? WHERE id = ?", [payload.featureImageUrl, project.id]);
    }

    const mediaValues: Array<[number, string, string | null, ProjectMediaKind, number]> = [];
    let galleryIndex = 0;

    if (payload.featureImageUrl) {
      mediaValues.push([project.id, payload.featureImageUrl, null, "FEATURE", 0]);
    }

    payload.gallery.forEach((item) => {
      if (!item.url) {
        return;
      }
      galleryIndex += 1;
      mediaValues.push([
        project.id,
        item.url,
        item.caption ?? null,
        "GALLERY",
        payload.featureImageUrl ? galleryIndex : galleryIndex - 1,
      ]);
    });

    if (mediaValues.length) {
      await insertManyMedia(mediaValues, connection);
    }

    const schemeValues: Array<[number, string, string, number]> = [];
    payload.schemes.forEach((item, index) => {
      if (!item.url) {
        return;
      }
      schemeValues.push([project.id, item.title ?? `Схема ${index + 1}`, item.url, index]);
    });

    if (schemeValues.length) {
      await insertManySchemes(schemeValues, connection);
    }
  });
}

async function fetchProjectByIdWithRelations(id: number, connection: PoolConnection): Promise<ProjectDetailRecord | null> {
  const [rows] = await connection.query<ProjectRow[]>(
    "SELECT id, slug, title, tagline, location, year, area, scope, intro, heroImageUrl, `order`, categories, content, createdAt, updatedAt FROM Project WHERE id = ? LIMIT 1",
    [id],
  );
  if (!rows.length) {
    return null;
  }
  const project = mapProjectRow(rows[0]);

  const [mediaRows] = await connection.query<ProjectMediaRow[]>(
    "SELECT id, projectId, url, caption, kind, `order`, createdAt FROM ProjectMedia WHERE projectId = ? ORDER BY `order` ASC, id ASC",
    [project.id],
  );
  const [schemeRows] = await connection.query<ProjectSchemeRow[]>(
    "SELECT id, projectId, title, url, `order`, createdAt FROM ProjectScheme WHERE projectId = ? ORDER BY `order` ASC, id ASC",
    [project.id],
  );

  return {
    ...project,
    media: mediaRows.map(mapMediaRow),
    schemes: schemeRows.map(mapSchemeRow),
  };
}

async function fetchProjectBySlugForTransaction(slug: string, connection: PoolConnection): Promise<ProjectRecord | null> {
  const [rows] = await connection.query<ProjectRow[]>(
    "SELECT id, slug, title, tagline, location, year, area, scope, intro, heroImageUrl, `order`, categories, content, createdAt, updatedAt FROM Project WHERE slug = ? LIMIT 1",
    [slug],
  );
  if (!rows.length) {
    return null;
  }
  return mapProjectRow(rows[0]);
}

function buildProjectInsertPayload(data: ProjectWriteData): unknown[] {
  const normalizedContent = normaliseProjectContent(data.content);
  return [
    data.slug,
    data.title,
    data.tagline,
    data.location,
    data.year,
    data.area,
    data.scope,
    data.intro,
    data.heroImageUrl,
    data.order,
    JSON.stringify(data.categories ?? []),
    normalizedContent ? JSON.stringify(normalizedContent) : null,
  ];
}

async function insertManyMedia(values: Array<[number, string, string | null, ProjectMediaKind, number]>, connection: PoolConnection) {
  const placeholders = values.map(() => "(?, ?, ?, ?, ?)").join(", ");
  const flat = values.reduce<unknown[]>((acc, value) => acc.concat(value), []);
  await connection.execute(`INSERT INTO ProjectMedia (projectId, url, caption, kind, \`order\`) VALUES ${placeholders}`, flat);
}

async function insertManySchemes(values: Array<[number, string, string, number]>, connection: PoolConnection) {
  const placeholders = values.map(() => "(?, ?, ?, ?)").join(", ");
  const flat = values.reduce<unknown[]>((acc, value) => acc.concat(value), []);
  await connection.execute(`INSERT INTO ProjectScheme (projectId, title, url, \`order\`) VALUES ${placeholders}`, flat);
}
