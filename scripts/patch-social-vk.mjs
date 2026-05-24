/**
 * В SiteSetting.socialLinks меняет URL VK на https://vk.ru/rinart_buro (в т.ч. с vk.com).
 */
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

function loadEnvFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return raw.split(/\r?\n/).reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return acc;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) return acc;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      acc[key] = value;
      return acc;
    }, {});
  } catch {
    return {};
  }
}

function parseDatabaseUrl(databaseUrl) {
  const parsed = new URL(databaseUrl.trim().replace(/^["']|["']$/g, ""));
  const database = parsed.pathname.replace(/^\//, "");
  if (!database) throw new Error("Database name missing in DATABASE_URL");
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username ?? ""),
    password: decodeURIComponent(parsed.password ?? ""),
    database,
  };
}

const VK_URL = "https://vk.ru/rinart_buro";

const root = process.cwd();
const env = { ...loadEnvFile(path.join(root, ".env")), ...loadEnvFile(path.join(root, ".env.local")) };
const databaseUrl = process.env.DATABASE_URL || env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL не задан (.env или .env.local).");
  process.exit(1);
}

const pool = await mysql.createPool({
  ...parseDatabaseUrl(databaseUrl),
  waitForConnections: true,
  connectionLimit: 2,
});

try {
  const [rows] = await pool.query("SELECT value FROM SiteSetting WHERE `key` = ? LIMIT 1", ["socialLinks"]);
  if (!rows.length || rows[0].value == null) {
    console.log("Нет записи socialLinks в БД — на сайте используются дефолты из кода (уже с vk.ru).");
    process.exit(0);
  }

  let raw = rows[0].value;
  if (Buffer.isBuffer(raw)) raw = raw.toString("utf8");
  let links = [];
  if (typeof raw === "string") {
    try {
      links = JSON.parse(raw);
    } catch {
      console.error("Не удалось разобрать JSON socialLinks.");
      process.exit(1);
    }
  } else if (Array.isArray(raw)) {
    links = raw;
  } else {
    console.error("socialLinks в БД не массив.");
    process.exit(1);
  }

  let changed = false;
  const next = links.map((item) => {
    if (!item || typeof item !== "object") return item;
    const isVk = item.platform === "vk" || item.id === "vk";
    const url = typeof item.url === "string" ? item.url : "";
    const oldVkCommunity = url.includes("vk.com/rinart_buro") || url.includes("vk.ru/rinart_buro");
    if (isVk || oldVkCommunity) {
      if (url !== VK_URL) changed = true;
      return { ...item, url: VK_URL };
    }
    return item;
  });

  if (!changed) {
    console.log("VK URL в socialLinks уже актуален.");
    process.exit(0);
  }

  await pool.execute(
    `INSERT INTO SiteSetting (\`key\`, value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value), updatedAt = CURRENT_TIMESTAMP`,
    ["socialLinks", JSON.stringify(next)],
  );
  console.log("OK: socialLinks обновлён — VK:", VK_URL);
} finally {
  await pool.end();
}
