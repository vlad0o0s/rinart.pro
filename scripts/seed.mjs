import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

function loadEnvFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const lines = raw.split(/\r?\n/);
    return lines.reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return acc;
      }
      const [key, ...rest] = trimmed.split("=");
      if (!key) {
        return acc;
      }
      const value = rest.join("=");
      acc[key.trim()] = value.trim();
      return acc;
    }, {});
  } catch (error) {
    return {};
  }
}

function getRequiredEnv(name, fallbackEnv) {
  const value = process.env[name] ?? fallbackEnv[name];
  if (!value) {
    console.error(`Missing ${name} environment variable. Set it in your shell or .env.local before running the seed.`);
    process.exit(1);
  }
  return value;
}

function parseDatabaseUrl(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    const database = parsed.pathname.replace(/^\//, "");
    if (!database) {
      throw new Error("Database name is missing in DATABASE_URL");
    }
    return {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 3306,
      user: decodeURIComponent(parsed.username ?? ""),
      password: decodeURIComponent(parsed.password ?? ""),
      database,
    };
  } catch (error) {
    console.error("Failed to parse DATABASE_URL", error.message);
    process.exit(1);
  }
}

function readJson(relativePath) {
  const filePath = path.join(process.cwd(), relativePath);
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function ensureFacts(value) {
  return ensureArray(value)
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const { label, value: factValue } = item;
      if (typeof label !== "string" || typeof factValue !== "string") {
        return null;
      }
      return { label, value: factValue };
    })
    .filter(Boolean);
}

function normaliseString(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const stringValue = String(value).trim();
  return stringValue.length ? stringValue : null;
}

const envFromFile = loadEnvFile(path.join(process.cwd(), ".env.local"));
const databaseUrl = getRequiredEnv("DATABASE_URL", envFromFile);

const connectionConfig = parseDatabaseUrl(databaseUrl);

const pool = await mysql.createPool({
  ...connectionConfig,
  waitForConnections: true,
  connectionLimit: 5,
  namedPlaceholders: false,
});

const connection = await pool.getConnection();

try {
  await connection.beginTransaction();

  console.log("Clearing existing data...");
  await connection.execute("SET FOREIGN_KEY_CHECKS = 0");
  await connection.execute("TRUNCATE TABLE ProjectMedia");
  await connection.execute("TRUNCATE TABLE ProjectScheme");
  await connection.execute("TRUNCATE TABLE Project");
  await connection.execute("SET FOREIGN_KEY_CHECKS = 1");

  const summaries = readJson("public/data/projects.json");
  const details = readJson("data/project-details.json");
  const detailBySlug = new Map(details.map((item) => [item.slug, item]));

  console.log("Seeding projects...");

  for (const summary of summaries) {
    const slug = summary.id;
    const orderValue = summary.order ? Number(summary.order) : 0;
    const detail = detailBySlug.get(slug) ?? {};

    const intro = normaliseString(detail.intro ?? (detail.description ? detail.description[0] : null));
    const contentBody = ensureArray(detail.description)
      .map((paragraph) => String(paragraph).trim())
      .filter((paragraph) => paragraph.length > 0);
    const facts = ensureFacts(detail.facts);

    const insertProjectSql = `INSERT INTO Project (slug, title, tagline, location, year, area, scope, intro, heroImageUrl, \`order\`, categories, content)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const [projectResult] = await connection.execute(
      insertProjectSql,
      [
        slug,
        detail.title ?? summary.title,
        normaliseString(detail.tagline),
        normaliseString(detail.location),
        normaliseString(detail.year),
        normaliseString(detail.area),
        normaliseString(detail.scope),
        intro,
        normaliseString(detail.heroImage ?? detail.heroImageUrl ?? null),
        Number.isFinite(orderValue) ? orderValue : 0,
        JSON.stringify(ensureArray(summary.categories)),
        contentBody.length || facts.length ? JSON.stringify({ body: contentBody, facts }) : null,
      ],
    );

    const projectId = Number(projectResult.insertId);

    const gallery = ensureArray(detail.gallery)
      .map((url) => String(url).trim())
      .filter((url) => url.length > 0);
    const schemes = ensureArray(detail.schemes).map((item) => {
      if (!item || typeof item !== "object") {
        const url = normaliseString(item);
        return url ? { title: null, image: url } : null;
      }
      return item;
    }).filter(Boolean);

    const featureImageUrl = normaliseString(detail.heroImage ?? detail.heroImageUrl ?? gallery[0] ?? null);
    let mediaOrder = 0;

    if (featureImageUrl) {
      await connection.execute(
        "INSERT INTO ProjectMedia (projectId, url, caption, kind, `order`) VALUES (?, ?, ?, 'FEATURE', ?)",
        [projectId, featureImageUrl, null, mediaOrder],
      );
      mediaOrder += 1;
    }

    for (const url of gallery) {
      await connection.execute(
        "INSERT INTO ProjectMedia (projectId, url, caption, kind, `order`) VALUES (?, ?, ?, 'GALLERY', ?)",
        [projectId, url, null, mediaOrder],
      );
      mediaOrder += 1;
    }

    for (let index = 0; index < schemes.length; index += 1) {
      const scheme = schemes[index];
      const schemeUrl = normaliseString(scheme.image ?? scheme.url);
      if (!schemeUrl) {
        continue;
      }
      const title = normaliseString(scheme.title) ?? `Схема ${index + 1}`;
      await connection.execute(
        "INSERT INTO ProjectScheme (projectId, title, url, `order`) VALUES (?, ?, ?, ?)",
        [projectId, title, schemeUrl, index],
      );
    }
  }

  await connection.commit();
  console.log("Seed completed successfully.");
} catch (error) {
  console.error("Seed failed, rolling back.", error);
  await connection.rollback();
  process.exitCode = 1;
} finally {
  connection.release();
  await pool.end();
}
