import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  createUploadsPersister,
  encodeForWeb,
  getAttr,
  replaceInlineImages,
  replaceInlineImagesDeep,
  setAttr,
} from "../lib/inline-images.cjs";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require("sharp");

function must<T>(value: T | null | undefined): T {
  assert.ok(value, "ожидался результат, а не null");
  return value;
}

function dataUri(bytes: Buffer, mime = "image/png") {
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

const fakePersist = async (_bytes: Buffer, hash: string) => ({
  url: `/uploads/inline-${hash}.webp`,
  width: 800,
  height: 600,
  format: "webp",
  bytes: 100,
});

test("картинка base64 заменяется ссылкой с размерами и подписью, остальная разметка не меняется", async () => {
  const bytes = Buffer.alloc(2048, 7);
  const html = `<p>Текст</p><img src="${dataUri(bytes)}" style="cursor: move;"><img src="/uploads/old.webp" alt="Старая"><p>Хвост</p>`;

  const { html: out, images } = await replaceInlineImages(html, { persist: fakePersist, altFor: () => "План первого этажа" });

  assert.equal(images.length, 1);
  assert.equal(images[0].status, "moved");
  assert.equal(images[0].altSource, "provided");
  assert.ok(!out.includes("data:image"));
  assert.match(
    out,
    /^<p>Текст<\/p><img src="\/uploads\/inline-[0-9a-f]{16}\.webp" style="cursor: move;" width="800" height="600" alt="План первого этажа" loading="lazy" decoding="async"><img src="\/uploads\/old\.webp" alt="Старая"><p>Хвост<\/p>$/,
  );
});

test("своя подпись и размеры картинки сохраняются, кавычки в подписи экранируются", async () => {
  const html = `<img alt='Фасад &quot;с юга&quot;' width="400" src='${dataUri(Buffer.alloc(4096, 1), "image/jpeg")}' />`;
  const { html: out, images } = await replaceInlineImages(html, { persist: fakePersist, altFor: () => "не должна попасть" });

  assert.equal(images[0].altSource, "existing");
  assert.equal(getAttr(out, "alt"), 'Фасад "с юга"');
  assert.equal(getAttr(out, "width"), "400");
  assert.equal(getAttr(out, "height"), null, "размеры не дописываются, если один уже задан редактором");
  assert.ok(out.endsWith(" />"));
});

test("мелкие заглушки и непереносимые форматы остаются как есть", async () => {
  const small = `<img src="${dataUri(Buffer.alloc(100, 1))}">`;
  const svg = `<img src="${dataUri(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), "image/svg+xml")}">`;

  const smallResult = await replaceInlineImages(small, { persist: fakePersist, minBytes: 1024 });
  assert.equal(smallResult.html, small);
  assert.equal(smallResult.images[0].status, "skipped-small");

  const svgResult = await replaceInlineImages(svg, { persist: async () => null });
  assert.equal(svgResult.html, svg);
  assert.equal(svgResult.images[0].status, "skipped-format");
});

test("base64 с переносами строк распознаётся; повторный проход ничего не меняет", async () => {
  const wrapped = Buffer.alloc(3000, 9).toString("base64").replace(/(.{76})/g, "$1\n");
  const html = `<div><img src="data:image/png;base64,${wrapped}"></div>`;

  const first = await replaceInlineImages(html, { persist: fakePersist, altFor: () => "Схема" });
  assert.equal(first.images.length, 1);
  assert.ok(!first.html.includes("data:image"));

  const second = await replaceInlineImages(first.html, { persist: fakePersist, altFor: () => "Схема" });
  assert.equal(second.images.length, 0);
  assert.equal(second.html, first.html);
});

test("обход описания проекта: меняется только HTML с картинками", async () => {
  const content = {
    body: ["Абзац без картинок"],
    facts: [{ label: "Площадь", value: "98 м²" }],
    seo: { title: "Баня" },
    bodyHtml: `<p>Абзац</p><img src="${dataUri(Buffer.alloc(5000, 3))}">`,
  };
  const { value, images } = await replaceInlineImagesDeep(content, { persist: fakePersist, altFor: () => "Баня" });
  const next = value as typeof content;

  assert.equal(images.length, 1);
  assert.deepEqual(next.body, content.body);
  assert.deepEqual(next.facts, content.facts);
  assert.deepEqual(next.seo, content.seo);
  assert.ok(next.bodyHtml.includes('alt="Баня"'));
  assert.ok(!JSON.stringify(next).includes("data:image"));
});

test("setAttr заменяет существующий атрибут на месте", () => {
  assert.equal(setAttr('<img src = "a.png" alt="x">', "src", "b.webp"), '<img src="b.webp" alt="x">');
  assert.equal(setAttr("<img src=a.png>", "alt", "План"), '<img src=a.png alt="План">');
});

async function drawingPng() {
  const lines = Array.from({ length: 40 }, (_, i) => `<line x1="${i * 30}" y1="0" x2="${1200 - i * 30}" y2="800" stroke="black" stroke-width="2"/>`).join("");
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="100%" height="100%" fill="white"/>${lines}<text x="40" y="60" font-size="32">План 1 этажа</text></svg>`);
  return sharp(svg).png().toBuffer();
}

test("чертёж в PNG сохраняется без потерь, фото в PNG — с потерями", async () => {
  const drawing = must(await encodeForWeb(await drawingPng(), sharp));
  assert.equal(drawing.format, "webp-lossless");
  assert.equal(drawing.ext, ".webp");
  assert.deepEqual([drawing.width, drawing.height], [1200, 800]);

  const noise = await sharp(randomBytes(600 * 400 * 3), { raw: { width: 600, height: 400, channels: 3 } }).png().toBuffer();
  const photo = must(await encodeForWeb(noise, sharp));
  assert.equal(photo.format, "webp");
  assert.ok(photo.buffer.length < noise.length);
});

test("большое изображение уменьшается до 2560 по длинной стороне, поворот EXIF учитывается", async () => {
  const big = await sharp({ create: { width: 3200, height: 1600, channels: 3, background: "#8a9" } }).jpeg({ quality: 95 }).toBuffer();
  const out = must(await encodeForWeb(big, sharp));
  assert.deepEqual([out.width, out.height], [2560, 1280]);

  const rotated = await sharp({ create: { width: 400, height: 200, channels: 3, background: "#456" } })
    .jpeg({ quality: 90 })
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const turned = must(await encodeForWeb(rotated, sharp));
  assert.deepEqual([turned.width, turned.height], [200, 400]);
});

test("SVG не переносится, GIF сохраняется как есть", async () => {
  assert.equal(await encodeForWeb(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'/>"), sharp), null);
  const gif = await sharp({ create: { width: 20, height: 10, channels: 3, background: "#f00" } }).gif().toBuffer();
  const out = must(await encodeForWeb(gif, sharp));
  assert.equal(out.format, "gif");
  assert.equal(out.buffer, gif);
});

test("файл называется по хешу: повторное сохранение не создаёт копию", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "rinart-inline-"));
  const bytes = await drawingPng();

  const first = await createUploadsPersister({ uploadsDir: dir, sharp })(bytes, "0123456789abcdef");
  const again = await createUploadsPersister({ uploadsDir: dir, sharp })(bytes, "0123456789abcdef");

  assert.ok(first && again);
  assert.equal(first.url, "/uploads/inline-0123456789abcdef.webp");
  assert.equal(again.url, first.url);
  assert.equal(again.reused, true);
  assert.deepEqual([again.width, again.height], [1200, 800]);
  assert.deepEqual(readdirSync(dir), ["inline-0123456789abcdef.webp"]);

  const dry = await createUploadsPersister({ uploadsDir: path.join(dir, "nothing"), write: false, sharp })(bytes, "fedcba9876543210");
  assert.ok(dry);
  assert.throws(() => readdirSync(path.join(dir, "nothing")), "пробный прогон ничего не пишет");
});
