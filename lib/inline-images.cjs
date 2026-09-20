"use strict";
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS-модуль: его без сборки запускает node */

/**
 * Картинки base64 в HTML описаний проектов → файлы в public/uploads.
 *
 * Редактор описаний раньше вставлял картинку целиком внутрь HTML (FileReader.readAsDataURL).
 * Описание уходит на страницу дважды — разметкой и в данных для React, — поэтому одна
 * фотография весила на странице вдвое больше себя, а у «Резиденции Алиф» HTML дорос до 6,8 МБ.
 *
 * Модуль общий для скрипта миграции (scripts/migrate-inline-images.mjs), для сохранения
 * проекта в админке и для загрузки картинок из редактора. CommonJS — чтобы его без сборки
 * запускал node и без изменений собирал Next.
 */

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

/** Длинная сторона после переноса: для страницы и увеличения по клику этого хватает с запасом. */
const MAX_SIDE = 2560;

/** Чертёж без потерь берём, пока он не больше лосси-версии в столько раз: линии важнее веса. */
const LOSSLESS_TOLERANCE = 1.6;

const IMG_TAG = /<img\b[^>]*>/gi;
const DATA_URI = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i;

function escapeAttr(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function unescapeAttr(value) {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function attrPattern(name) {
  return new RegExp(`(\\s${name}\\s*=\\s*)(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i");
}

/** Значение атрибута тега или null, если атрибута нет. */
function getAttr(tag, name) {
  const match = attrPattern(name).exec(tag);
  if (!match) {
    return null;
  }
  return unescapeAttr(match[2] ?? match[3] ?? match[4] ?? "");
}

/** Ставит атрибут: заменяет существующий или дописывает перед закрытием тега. */
function setAttr(tag, name, value) {
  const rendered = `${name}="${escapeAttr(value)}"`;
  const pattern = attrPattern(name);
  if (pattern.test(tag)) {
    return tag.replace(pattern, (_, prefix) => `${prefix.replace(/\s*=\s*$/, "=").replace(/^\s+/, " ")}"${escapeAttr(value)}"`);
  }
  return tag.replace(/\s*(\/?)>$/, (_, slash) => ` ${rendered}${slash ? " /" : ""}>`);
}

function parseDataUri(value) {
  const match = DATA_URI.exec(value.trim());
  if (!match) {
    return null;
  }
  return { mime: match[1].toLowerCase(), bytes: Buffer.from(match[2].replace(/\s+/g, ""), "base64") };
}

function hashBytes(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 16);
}

/**
 * Заменяет в HTML картинки base64 на ссылки на файлы.
 *
 * @param {string} html
 * @param {{
 *   persist: (bytes: Buffer, hash: string, mime: string) => Promise<{ url: string, width?: number, height?: number, format?: string, bytes?: number, reused?: boolean } | null>,
 *   minBytes?: number,
 *   altFor?: (hash: string, position: number) => string | null | undefined,
 * }} options
 *   persist — сохраняет картинку и возвращает её адрес; null — формат не переносится, тег остаётся как есть.
 *   minBytes — картинки меньше этого размера (технические заглушки) не трогаем.
 *   altFor — подпись для картинки без alt; position — номер картинки в этом HTML, с 1.
 */
async function replaceInlineImages(html, options) {
  const { persist, minBytes = 0, altFor } = options;
  const images = [];
  if (typeof html !== "string" || !html.includes("data:image")) {
    return { html, images };
  }

  const tags = html.match(IMG_TAG) ?? [];
  let result = "";
  let cursor = 0;
  let position = 0;

  for (const tag of tags) {
    const start = html.indexOf(tag, cursor);
    result += html.slice(cursor, start);
    cursor = start + tag.length;
    position += 1;

    const src = getAttr(tag, "src");
    const parsed = src && src.trim().toLowerCase().startsWith("data:image") ? parseDataUri(src) : null;
    if (!parsed) {
      result += tag;
      continue;
    }

    const hash = hashBytes(parsed.bytes);
    const entry = { position, hash, mime: parsed.mime, bytesIn: parsed.bytes.length, status: "skipped-small" };
    images.push(entry);

    if (parsed.bytes.length < minBytes) {
      result += tag;
      continue;
    }

    const saved = await persist(parsed.bytes, hash, parsed.mime);
    if (!saved) {
      entry.status = "skipped-format";
      result += tag;
      continue;
    }

    let next = setAttr(tag, "src", saved.url);
    if (saved.width && saved.height && getAttr(tag, "width") === null && getAttr(tag, "height") === null) {
      next = setAttr(setAttr(next, "width", saved.width), "height", saved.height);
    }

    const existingAlt = (getAttr(tag, "alt") ?? "").trim();
    const alt = existingAlt || (altFor ? (altFor(hash, position) ?? "").trim() : "");
    next = setAttr(next, "alt", alt);
    if (getAttr(tag, "loading") === null) {
      next = setAttr(next, "loading", "lazy");
    }
    if (getAttr(tag, "decoding") === null) {
      next = setAttr(next, "decoding", "async");
    }

    Object.assign(entry, {
      status: "moved",
      url: saved.url,
      width: saved.width,
      height: saved.height,
      format: saved.format,
      bytesOut: saved.bytes,
      reused: Boolean(saved.reused),
      alt,
      altSource: existingAlt ? "existing" : alt ? "provided" : "none",
    });
    result += next;
  }

  result += html.slice(cursor);
  return { html: result, images };
}

/** Обходит JSON описания и применяет replaceInlineImages к каждой строке. */
async function replaceInlineImagesDeep(value, options) {
  const images = [];
  async function walk(node) {
    if (typeof node === "string") {
      const { html, images: found } = await replaceInlineImages(node, options);
      images.push(...found);
      return html;
    }
    if (Array.isArray(node)) {
      const out = [];
      for (const item of node) {
        out.push(await walk(item));
      }
      return out;
    }
    if (node && typeof node === "object") {
      const out = {};
      for (const [key, item] of Object.entries(node)) {
        out[key] = await walk(item);
      }
      return out;
    }
    return node;
  }
  const result = await walk(value);
  return { value: result, images };
}

/**
 * Кодирует картинку для страницы. Чертежи и схемы — WebP без потерь, если это не делает
 * файл заметно тяжелее; фотографии — WebP с потерями. Уже сжатый JPEG без выигрыша
 * не пережимается, чтобы не терять качество второй раз.
 */
async function encodeForWeb(input, sharp) {
  const meta = await sharp(input, { failOnError: false }).metadata();
  const format = meta.format;

  // Поворот по EXIF меняет местами ширину и высоту.
  const rotated = typeof meta.orientation === "number" && meta.orientation >= 5;
  const naturalWidth = rotated ? meta.height : meta.width;
  const naturalHeight = rotated ? meta.width : meta.height;

  if (format === "gif") {
    return { buffer: input, ext: ".gif", format: "gif", width: naturalWidth, height: naturalHeight };
  }
  if (!["jpeg", "png", "webp", "avif", "heif", "tiff"].includes(format)) {
    return null;
  }

  const pipeline = () =>
    sharp(input, { failOnError: false })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true });

  const lossy = await pipeline().webp({ quality: 82, effort: 5 }).toBuffer({ resolveWithObject: true });
  const pick = (out, kind) => ({ buffer: out.data, ext: ".webp", format: kind, width: out.info.width, height: out.info.height });

  if (format === "png") {
    const lossless = await pipeline().webp({ lossless: true, effort: 5 }).toBuffer({ resolveWithObject: true });
    return lossless.data.length <= lossy.data.length * LOSSLESS_TOLERANCE ? pick(lossless, "webp-lossless") : pick(lossy, "webp");
  }

  const fitsAsIs = (naturalWidth ?? 0) <= MAX_SIDE && (naturalHeight ?? 0) <= MAX_SIDE;
  if (format === "jpeg" && fitsAsIs && lossy.data.length >= input.length * 0.9) {
    return { buffer: input, ext: ".jpg", format: "jpeg", width: naturalWidth, height: naturalHeight };
  }

  return pick(lossy, "webp");
}

async function findExisting(dir, prefix) {
  try {
    const names = await fs.readdir(dir);
    return names.find((name) => name.startsWith(prefix)) ?? null;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Сохранение в public/uploads. Имя файла — хеш исходных байтов: повторный запуск и та же
 * картинка в двух описаниях дают один и тот же файл, а не копии.
 *
 * @param {{ uploadsDir: string, publicPrefix?: string, write?: boolean, previewDir?: string | null, sharp?: any }} options
 *   write: false — ничего не записывать в uploads (пробный прогон).
 *   previewDir — куда дополнительно положить результат для просмотра.
 */
function createUploadsPersister(options) {
  const { uploadsDir, publicPrefix = "/uploads/", write = true, previewDir = null } = options;
  const sharp = options.sharp ?? require("sharp");
  const memo = new Map();

  return async function persist(bytes, hash) {
    if (memo.has(hash)) {
      return { ...memo.get(hash), reused: true };
    }

    const prefix = `inline-${hash}.`;
    const existing = await findExisting(uploadsDir, prefix);
    let saved;

    if (existing) {
      const file = path.join(uploadsDir, existing);
      const meta = await sharp(file, { failOnError: false }).metadata();
      const stat = await fs.stat(file);
      const rotated = typeof meta.orientation === "number" && meta.orientation >= 5;
      saved = {
        url: `${publicPrefix}${existing}`,
        width: rotated ? meta.height : meta.width,
        height: rotated ? meta.width : meta.height,
        format: meta.format,
        bytes: stat.size,
        reused: true,
      };
    } else {
      const encoded = await encodeForWeb(bytes, sharp);
      if (!encoded) {
        return null;
      }
      const name = `inline-${hash}${encoded.ext}`;
      if (write) {
        await fs.mkdir(uploadsDir, { recursive: true });
        await fs.writeFile(path.join(uploadsDir, name), encoded.buffer, { flag: "wx" }).catch((error) => {
          if (!error || error.code !== "EEXIST") {
            throw error;
          }
        });
      }
      if (previewDir) {
        await fs.mkdir(previewDir, { recursive: true });
        await fs.writeFile(path.join(previewDir, name), encoded.buffer);
      }
      saved = { url: `${publicPrefix}${name}`, width: encoded.width, height: encoded.height, format: encoded.format, bytes: encoded.buffer.length, reused: false };
    }

    memo.set(hash, saved);
    return saved;
  };
}

module.exports = {
  MAX_SIDE,
  createUploadsPersister,
  encodeForWeb,
  getAttr,
  hashBytes,
  replaceInlineImages,
  replaceInlineImagesDeep,
  setAttr,
};
