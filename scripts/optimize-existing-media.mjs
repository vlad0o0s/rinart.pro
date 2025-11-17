import fs from "fs";
import path from "path";
import { promises as fsp } from "fs";
import mysql from "mysql2/promise";
import sharp from "sharp";

function loadEnvFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .reduce((acc, line) => {
        const [key, ...rest] = line.split("=");
        if (!key) return acc;
        acc[key.trim()] = stripEnclosingQuotes(rest.join("=").trim());
        return acc;
      }, {});
  } catch {
    return {};
  }
}

function stripEnclosingQuotes(value) {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === `"` && last === `"`) || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

const uploadsDir = path.join(process.cwd(), "public", "uploads");

const EXT_MIME_MAP = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
};

const NON_CONVERTIBLE_EXT = new Set([".svg", ".gif", ".webp"]);
const NON_CONVERTIBLE_MIME = new Set(["image/svg+xml", "image/gif"]);

async function convertBuffer(buffer, mimeType) {
  if (NON_CONVERTIBLE_MIME.has(mimeType)) {
    return { buffer, extension: null, mimeType };
  }

  const instance = sharp(buffer, { failOnError: false }).rotate();

  // Используем только WebP для конвертации
  try {
    const webp = await instance.clone().webp({ quality: 75, effort: 4 }).toBuffer();
    return { buffer: webp, extension: ".webp", mimeType: "image/webp" };
  } catch {
    return { buffer, extension: null, mimeType };
  }
}

function sanitiseBase(name) {
  return name.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function findExistingOptimised(baseName) {
  for (const extension of [".avif", ".webp"]) {
    const candidate = path.join(uploadsDir, `${baseName}${extension}`);
    try {
      await fsp.access(candidate);
      return `/uploads/${path.basename(candidate)}`;
    } catch {
      // continue
    }
  }
  return null;
}

async function optimiseFile(url) {
  if (!url || typeof url !== "string") return null;
  if (!url.startsWith("/uploads/")) return null;

  const relativePath = url.replace(/^\//, "");
  const absolutePath = path.join(process.cwd(), "public", relativePath);

  const currentExt = path.extname(url).toLowerCase();
  if (NON_CONVERTIBLE_EXT.has(currentExt)) {
    return null;
  }

  const baseNameRaw = path.basename(url, currentExt);
  const baseName = sanitiseBase(baseNameRaw) || "image";

  try {
    await fsp.access(absolutePath);
  } catch (accessError) {
    if (accessError && accessError.code === "ENOENT") {
      const existing = await findExistingOptimised(baseName);
      if (existing) {
        return existing;
      }
    }
    throw accessError;
  }

  try {
    const buffer = await fsp.readFile(absolutePath);
    if (!buffer.length) return null;

    const mimeGuess = EXT_MIME_MAP[currentExt] ?? "image/jpeg";
    const { buffer: optimisedBuffer, extension } = await convertBuffer(buffer, mimeGuess);

    if (!extension || extension === currentExt) {
      return null;
    }

    let targetName = `${baseName}${extension}`;
    let counter = 1;
    while (true) {
      const candidatePath = path.join(uploadsDir, targetName);
      try {
        await fsp.access(candidatePath);
        targetName = `${baseName}-${counter}${extension}`;
        counter += 1;
      } catch {
        break;
      }
    }

    const newPath = path.join(uploadsDir, targetName);
    await fsp.writeFile(newPath, optimisedBuffer);
    await fsp.unlink(absolutePath);

    return `/uploads/${targetName}`;
  } catch (error) {
    console.warn(`Failed to optimise ${url}:`, error.message ?? error);
    return null;
  }
}

async function processTable(connection, table, column) {
  const [rows] = await connection.query(`SELECT id, ${column} AS url FROM ${table}`);
  for (const row of rows) {
    const newUrl = await optimiseFile(row.url);
    if (newUrl && newUrl !== row.url) {
      await connection.execute(`UPDATE ${table} SET ${column} = ? WHERE id = ?`, [newUrl, row.id]);
      console.log(`[updated] ${table}#${row.id} -> ${newUrl}`);
    }
  }
}

async function main() {
  const envFromFile = loadEnvFile(path.join(process.cwd(), ".env.local"));
  const databaseUrl = (process.env.DATABASE_URL ?? envFromFile.DATABASE_URL ?? "").trim();

  let connection;
  const connectWithVars = async () => {
    const host = (process.env.MYSQL_HOST ?? envFromFile.MYSQL_HOST ?? "localhost").trim();
    const user = (process.env.MYSQL_USER ?? envFromFile.MYSQL_USER ?? "root").trim();
    const password = (process.env.MYSQL_PASSWORD ?? envFromFile.MYSQL_PASSWORD ?? "").trim();
    const database = (process.env.MYSQL_DATABASE ?? envFromFile.MYSQL_DATABASE ?? "").trim();
    if (!database) {
      throw new Error("MYSQL_DATABASE is not set; provide DATABASE_URL or explicit connection params.");
    }
    const portRaw = (process.env.MYSQL_PORT ?? envFromFile.MYSQL_PORT ?? "").trim();
    const port = portRaw ? Number(portRaw) : 3306;
    return mysql.createConnection({
      host,
      user,
      password,
      database,
      port,
      namedPlaceholders: false,
    });
  };

  if (databaseUrl) {
    try {
      connection = await mysql.createConnection(databaseUrl);
    } catch (error) {
      console.warn("Failed to use DATABASE_URL, falling back to discrete MySQL env vars:", error.message ?? error);
      try {
        connection = await connectWithVars();
      } catch (innerError) {
        console.error("Failed to create MySQL connection:", innerError.message ?? innerError);
        process.exit(1);
      }
    }
  } else {
    try {
      connection = await connectWithVars();
    } catch (error) {
      console.error("Failed to create MySQL connection:", error.message ?? error);
      process.exit(1);
    }
  }

  try {
    await fsp.mkdir(uploadsDir, { recursive: true });
    await processTable(connection, "MediaAsset", "url");
    await processTable(connection, "ProjectMedia", "url");
    await processTable(connection, "ProjectScheme", "url");
    await processTable(connection, "PageSeo", "ogImageUrl");
    console.log("Media optimisation completed.");
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

