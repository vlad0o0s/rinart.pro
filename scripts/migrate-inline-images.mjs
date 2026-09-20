/**
 * Переносит картинки base64 из описаний проектов в файлы public/uploads (RIN-04, RIN-18).
 *
 * По умолчанию — пробный прогон: ничего не пишет ни в базу, ни в uploads, только считает
 * и показывает, что изменится. С --preview-dir кладёт готовые файлы в указанный каталог,
 * чтобы их можно было посмотреть и подписать.
 *
 *   node scripts/migrate-inline-images.mjs --preview-dir /tmp/inline-preview --report /tmp/inline-report.json
 *   node scripts/migrate-inline-images.mjs --apply --backup /root/backups/rinart/<метка> --alts alts.json
 *
 * Флаги:
 *   --apply                 записать файлы и обновить описания в базе
 *   --backup <каталог>      обязателен с --apply: копия backup.mjs, сделанная сегодня
 *   --alts <файл.json>      подписи { "<хеш>": "что на картинке" }; хеши — в отчёте пробного прогона
 *   --allow-fallback-alt    разрешить подпись по названию проекта там, где своей нет
 *   --only <slug>           только один проект
 *   --min-bytes <число>     не трогать картинки меньше этого размера (по умолчанию 10 240)
 *   --report <файл.json>    сохранить подробный отчёт
 *
 * Повторный запуск безопасен: имя файла — хеш содержимого, уже перенесённые картинки
 * в описаниях не встречаются, существующие файлы переиспользуются. Описание обновляется,
 * только если проект не правили в админке с момента чтения (проверка по updatedAt).
 * База — одно соединение: у хостинга жёсткий лимит соединений.
 */

import fs from "fs";
import path from "path";
import { createRequire } from "module";
import mysql from "mysql2/promise";
import sharp from "sharp";

const requireCjs = createRequire(import.meta.url);
const { encodeForWeb, replaceInlineImagesDeep } = requireCjs("../lib/inline-images.cjs");

const PROJECT_DIR = process.cwd();
const UPLOADS_DIR = path.join(PROJECT_DIR, "public", "uploads");

function parseArgs(argv) {
  const args = { apply: false, allowFallbackAlt: false, minBytes: 10240 };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = () => {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        throw new Error(`Флагу ${flag} нужно значение`);
      }
      i += 1;
      return next;
    };
    if (flag === "--apply") args.apply = true;
    else if (flag === "--dry-run") args.apply = false;
    else if (flag === "--allow-fallback-alt") args.allowFallbackAlt = true;
    else if (flag === "--backup") args.backup = value();
    else if (flag === "--alts") args.alts = value();
    else if (flag === "--only") args.only = value();
    else if (flag === "--min-bytes") args.minBytes = Number(value());
    else if (flag === "--report") args.report = value();
    else if (flag === "--preview-dir") args.previewDir = value();
    else throw new Error(`Неизвестный флаг: ${flag}`);
  }
  if (!Number.isFinite(args.minBytes) || args.minBytes < 0) {
    throw new Error("--min-bytes должен быть неотрицательным числом");
  }
  return args;
}

function readEnvValue(file, key) {
  if (!fs.existsSync(file)) {
    return null;
  }
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0 || line.slice(0, eq).trim() !== key) continue;
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return null;
}

/** JSON-колонки читаем байтами и декодируем сами — так кириллица не зависит от настроек соединения. */
function typeCast(field, next) {
  if (field.type === "JSON") {
    const buf = field.buffer();
    return buf === null ? null : buf.toString("utf8");
  }
  return next();
}

function checkBackup(dir, projectCount) {
  const manifestFile = path.join(dir, "manifest.json");
  if (!fs.existsSync(manifestFile) || !fs.existsSync(path.join(dir, "db", "Project.ndjson.gz"))) {
    throw new Error(`В ${dir} нет копии таблицы Project — сначала запустите backup.mjs`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  const ageHours = (Date.now() - new Date(manifest.createdAt).getTime()) / 3600000;
  if (!(ageHours < 24)) {
    throw new Error(`Копии ${dir} больше суток — сделайте свежую`);
  }
  if ((manifest.tables?.Project?.rows ?? 0) < projectCount) {
    throw new Error("В копии меньше проектов, чем в базе — сделайте свежую копию");
  }
  return { createdAt: manifest.createdAt, ageHours: Number(ageHours.toFixed(1)) };
}

function findExistingFile(hash) {
  if (!fs.existsSync(UPLOADS_DIR)) {
    return null;
  }
  return fs.readdirSync(UPLOADS_DIR).find((name) => name.startsWith(`inline-${hash}.`)) ?? null;
}

function createPersist({ write, previewDir }) {
  const memo = new Map();
  return async function persist(bytes, hash) {
    if (memo.has(hash)) {
      return { ...memo.get(hash), reused: true };
    }

    let saved;
    const existing = findExistingFile(hash);
    if (existing) {
      const file = path.join(UPLOADS_DIR, existing);
      const meta = await sharp(file, { failOnError: false }).metadata();
      const rotated = typeof meta.orientation === "number" && meta.orientation >= 5;
      saved = {
        url: `/uploads/${existing}`,
        width: rotated ? meta.height : meta.width,
        height: rotated ? meta.width : meta.height,
        format: meta.format,
        bytes: fs.statSync(file).size,
        reused: true,
      };
    } else {
      const encoded = await encodeForWeb(bytes, sharp);
      if (!encoded) {
        return null;
      }
      const name = `inline-${hash}${encoded.ext}`;
      if (write) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        try {
          fs.writeFileSync(path.join(UPLOADS_DIR, name), encoded.buffer, { flag: "wx" });
        } catch (error) {
          if (error.code !== "EEXIST") throw error;
        }
      }
      if (previewDir) {
        fs.mkdirSync(previewDir, { recursive: true });
        fs.writeFileSync(path.join(previewDir, name), encoded.buffer);
      }
      saved = { url: `/uploads/${name}`, width: encoded.width, height: encoded.height, format: encoded.format, bytes: encoded.buffer.length, reused: false };
    }

    memo.set(hash, saved);
    return saved;
  };
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(0)} КБ`;
}

async function scanOtherTables(connection) {
  const checks = [
    ["Project.heroImageUrl", "SELECT COUNT(*) AS n FROM Project WHERE heroImageUrl LIKE 'data:%'"],
    ["ProjectMedia.url", "SELECT COUNT(*) AS n FROM ProjectMedia WHERE url LIKE 'data:%'"],
    ["ProjectScheme.url", "SELECT COUNT(*) AS n FROM ProjectScheme WHERE url LIKE 'data:%'"],
    ["MediaAsset.url", "SELECT COUNT(*) AS n FROM MediaAsset WHERE url LIKE 'data:%'"],
    ["GlobalBlock.data", "SELECT COUNT(*) AS n FROM GlobalBlock WHERE CAST(data AS CHAR) LIKE '%data:image%'"],
    ["SiteSetting.value", "SELECT COUNT(*) AS n FROM SiteSetting WHERE CAST(value AS CHAR) LIKE '%data:image%'"],
    ["TeamMember.imageUrl", "SELECT COUNT(*) AS n FROM TeamMember WHERE imageUrl LIKE 'data:%' OR mobileImageUrl LIKE 'data:%'"],
  ];
  const result = {};
  for (const [label, sql] of checks) {
    try {
      const [rows] = await connection.query(sql);
      result[label] = Number(rows[0].n);
    } catch (error) {
      result[label] = `ошибка: ${error.code ?? error.message}`;
    }
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const alts = args.alts ? JSON.parse(fs.readFileSync(args.alts, "utf8")) : {};

  const databaseUrl = (process.env.DATABASE_URL ?? readEnvValue(path.join(PROJECT_DIR, ".env"), "DATABASE_URL") ?? "").trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL не найден ни в окружении, ни в .env");
  }

  const connection = await mysql.createConnection({ uri: databaseUrl, charset: "utf8mb4", dateStrings: true, typeCast });
  const report = {
    mode: args.apply ? "apply" : "dry-run",
    startedAt: new Date().toISOString(),
    minBytes: args.minBytes,
    backup: null,
    otherTables: {},
    projects: [],
    conflicts: [],
    missingAlts: [],
  };

  try {
    await connection.query("SET NAMES utf8mb4");
    report.otherTables = await scanOtherTables(connection);

    const [[{ total }]] = await connection.query("SELECT COUNT(*) AS total FROM Project");
    if (args.apply) {
      if (!args.backup) {
        throw new Error("С --apply нужен --backup <каталог копии>");
      }
      report.backup = { dir: args.backup, ...checkBackup(args.backup, Number(total)) };
    }

    const [rows] = await connection.query(
      `SELECT id, slug, title, content, updatedAt FROM Project
       WHERE CAST(content AS CHAR) LIKE '%data:image%' ${args.only ? "AND slug = ?" : ""}
       ORDER BY \`order\` ASC, id ASC`,
      args.only ? [args.only] : [],
    );

    // Сначала только считаем картинки: подписи проверяются до того, как что-то записано.
    const plans = [];
    for (const row of rows) {
      const content = JSON.parse(row.content);
      const scan = await replaceInlineImagesDeep(content, { persist: async () => null, minBytes: 0 });
      const movable = scan.images.filter((image) => image.bytesIn >= args.minBytes);
      plans.push({ row, content, movable, total: scan.images.length });
      for (const image of movable) {
        if (!alts[image.hash]) {
          report.missingAlts.push({ slug: row.slug, position: image.position, hash: image.hash, bytes: image.bytesIn });
        }
      }
    }

    if (args.apply && report.missingAlts.length && !args.allowFallbackAlt) {
      throw new Error(
        `У ${report.missingAlts.length} картинок нет подписи в --alts. Подпишите их или добавьте --allow-fallback-alt.`,
      );
    }

    const persist = createPersist({ write: args.apply, previewDir: args.previewDir });

    for (const { row, content, movable, total: found } of plans) {
      const imagesInProject = movable.length;
      const altFor = (hash, position) => {
        if (alts[hash]) return alts[hash];
        const index = movable.findIndex((image) => image.hash === hash && image.position === position);
        const number = index >= 0 ? index + 1 : position;
        return imagesInProject > 1 ? `${row.title} — изображение ${number}` : row.title;
      };

      const { value: nextContent, images } = await replaceInlineImagesDeep(content, {
        persist,
        minBytes: args.minBytes,
        altFor,
      });

      const before = Buffer.byteLength(row.content, "utf8");
      const serialized = JSON.stringify(nextContent);
      const after = Buffer.byteLength(serialized, "utf8");
      const remaining = (serialized.match(/data:image\//g) ?? []).length;
      const entry = {
        id: row.id,
        slug: row.slug,
        title: row.title,
        found,
        moved: images.filter((image) => image.status === "moved").length,
        contentBytesBefore: before,
        contentBytesAfter: after,
        remainingDataImages: remaining,
        images,
        updated: false,
      };

      if (args.apply && entry.moved > 0) {
        const [result] = await connection.query("UPDATE Project SET content = ? WHERE id = ? AND updatedAt = ?", [
          serialized,
          row.id,
          row.updatedAt,
        ]);
        if (result.affectedRows === 1) {
          entry.updated = true;
        } else {
          report.conflicts.push({ slug: row.slug, reason: "проект изменили во время переноса — запустите скрипт ещё раз" });
        }
      }

      report.projects.push(entry);
    }
  } finally {
    await connection.end();
  }

  report.finishedAt = new Date().toISOString();
  const totals = report.projects.reduce(
    (acc, project) => ({
      projects: acc.projects + 1,
      moved: acc.moved + project.moved,
      before: acc.before + project.contentBytesBefore,
      after: acc.after + project.contentBytesAfter,
      filesBytes: acc.filesBytes + project.images.reduce((sum, image) => sum + (image.reused ? 0 : image.bytesOut ?? 0), 0),
      remaining: acc.remaining + project.remainingDataImages,
      updated: acc.updated + (project.updated ? 1 : 0),
    }),
    { projects: 0, moved: 0, before: 0, after: 0, filesBytes: 0, remaining: 0, updated: 0 },
  );
  report.totals = totals;

  if (args.report) {
    fs.writeFileSync(args.report, JSON.stringify(report, null, 2));
  }

  console.log(`Режим: ${report.mode === "apply" ? "ЗАПИСЬ" : "пробный прогон — ничего не записано"}`);
  if (report.backup) console.log(`Копия: ${report.backup.dir} (${report.backup.ageHours} ч назад)`);
  console.log("Картинки base64 в других таблицах:", JSON.stringify(report.otherTables));
  for (const project of report.projects) {
    const formats = project.images
      .filter((image) => image.status === "moved")
      .map((image) => `${image.format} ${image.width}×${image.height} ${kb(image.bytesIn)}→${kb(image.bytesOut ?? 0)}`)
      .join("; ");
    console.log(
      `  ${project.slug}: найдено ${project.found}, перенесено ${project.moved}, описание ${kb(project.contentBytesBefore)} → ${kb(project.contentBytesAfter)}` +
        `${project.remainingDataImages ? `, осталось base64: ${project.remainingDataImages}` : ""}${project.updated ? ", обновлено" : ""}` +
        (formats ? `\n      ${formats}` : ""),
    );
  }
  console.log(
    `Итого: проектов ${totals.projects}, картинок перенесено ${totals.moved}, описания ${kb(totals.before)} → ${kb(totals.after)}, ` +
      `новые файлы ${kb(totals.filesBytes)}, осталось base64 ${totals.remaining}${report.mode === "apply" ? `, обновлено проектов ${totals.updated}` : ""}`,
  );
  if (report.missingAlts.length) console.log(`Без подписи в --alts: ${report.missingAlts.length} картинок (хеши — в отчёте)`);
  if (report.conflicts.length) console.log("Конфликты:", JSON.stringify(report.conflicts));
  if (report.mode === "apply" && totals.updated) {
    console.log("Сайт держит описания в памяти до 60 секунд: изменения появятся на страницах в течение минуты.");
  }
}

main().catch((error) => {
  console.error("ОШИБКА:", error.message);
  process.exit(1);
});
