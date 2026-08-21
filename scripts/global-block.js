/**
 * Чтение и правка блока GlobalBlock (rinart.pro).
 *   node global-block.js show
 *   node global-block.js set <slug> <imageUrl>
 * Запускать из /home/rinart.pro — DATABASE_URL берётся из локального .env.
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

function loadDatabaseUrl() {
  const env = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/);
    if (m) return m[1].replace(/^["']|["']$/g, "");
  }
  throw new Error("DATABASE_URL not found in .env");
}

(async () => {
  const [cmd, slug, imageUrl] = process.argv.slice(2);
  const conn = await mysql.createConnection(loadDatabaseUrl());
  try {
    if (cmd === "set") {
      if (!slug || !imageUrl) throw new Error("usage: set <slug> <imageUrl>");
      const [before] = await conn.query("SELECT slug, data, updatedAt FROM GlobalBlock WHERE slug = ?", [slug]);
      console.log("BEFORE:", JSON.stringify(before));
      await conn.execute(
        `INSERT INTO GlobalBlock (slug, data) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE data = VALUES(data), updatedAt = CURRENT_TIMESTAMP`,
        [slug, JSON.stringify({ imageUrl })],
      );
    }
    const [rows] = await conn.query("SELECT slug, data, updatedAt FROM GlobalBlock ORDER BY slug");
    for (const r of rows) {
      const data = typeof r.data === "string" ? r.data : JSON.stringify(r.data);
      console.log(`${r.slug} | ${r.updatedAt.toISOString()} | ${data.slice(0, 200)}`);
    }
  } finally {
    await conn.end();
  }
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
