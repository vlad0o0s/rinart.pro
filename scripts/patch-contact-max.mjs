/**
 * Обновляет в БД ссылку и подпись CTA (бывш. WhatsApp) на MAX.
 * Дефолты в коде не подставляются, если в SiteSetting уже есть сохранённые контакты.
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

const root = process.cwd();
const env = { ...loadEnvFile(path.join(root, ".env")), ...loadEnvFile(path.join(root, ".env.local")) };
const databaseUrl = process.env.DATABASE_URL || env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL не задан (.env или .env.local).");
  process.exit(1);
}

const MAX_CTA_URL =
  "https://max.ru/u/f9LHodD0cOJh_cKr5v3ZlDYwFYqPyrvQAHu9h_-XdifygXGo0tdja8HwEuk";
const MAX_CHANNEL_URL = "https://max.ru/id165504914483_biz";
const MAX_LABEL = "Перейти в MAX";
const MAX_CHANNEL_LABEL = "rinartburo";

const defaults = {
  heroTitle: "Контактная информация",
  phoneLabel: "+7 903 147-44-30",
  phoneHref: "tel:+79031474430",
  emailLabel: "rinartburo@mail.ru",
  emailHref: "mailto:rinartburo@mail.ru",
  locationLabel: "Москва, Российская Федерация",
  heroImageUrl: "/img/group-1005.webp",
  footerTitle: "Обсудим ваш проект:",
  cityLabel: "г. Москва",
  whatsappLabel: MAX_LABEL,
  whatsappUrl: MAX_CTA_URL,
  maxChannelUrl: MAX_CHANNEL_URL,
  maxChannelLabel: MAX_CHANNEL_LABEL,
  backToTopLabel: "В начало",
};

const pool = await mysql.createPool({
  ...parseDatabaseUrl(databaseUrl),
  waitForConnections: true,
  connectionLimit: 2,
});

try {
  const [rows] = await pool.query("SELECT value FROM SiteSetting WHERE `key` = ? LIMIT 1", ["contact"]);
  let contact = defaults;
  if (rows.length && rows[0].value != null) {
    let raw = rows[0].value;
    if (Buffer.isBuffer(raw)) raw = raw.toString("utf8");
    if (typeof raw === "string") {
      try {
        contact = { ...defaults, ...JSON.parse(raw) };
      } catch {
        contact = { ...defaults };
      }
    } else if (typeof raw === "object") {
      contact = { ...defaults, ...raw };
    }
  }
  contact.whatsappUrl = MAX_CTA_URL;
  contact.whatsappLabel = MAX_LABEL;
  contact.maxChannelUrl = MAX_CHANNEL_URL;
  contact.maxChannelLabel = MAX_CHANNEL_LABEL;

  await pool.execute(
    `INSERT INTO SiteSetting (\`key\`, value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value), updatedAt = CURRENT_TIMESTAMP`,
    ["contact", JSON.stringify(contact)],
  );
  console.log("OK: contact обновлён — кнопка MAX (профиль), канал (иконка/контакты).");
} finally {
  await pool.end();
}
