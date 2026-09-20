import assert from "node:assert/strict";
import { test } from "node:test";
import { ARTICLE_BODY_SIZES, PROJECT_DESCRIPTION_SIZES, prepareRichHtml } from "../lib/rich-html";

const UPLOADED_IMAGE =
  '<img src="/uploads/inline-1bbd803a91220671.webp" draggable="true" style="cursor: move;" width="1834" height="1440" alt="Дом Идальго — изображение 1" loading="lazy" decoding="async">';

test("следы редактора не уходят на сайт", () => {
  const result = prepareRichHtml(UPLOADED_IMAGE);
  assert.ok(!result.includes("draggable"));
  assert.ok(!result.includes("cursor"));
  assert.ok(!result.includes("style="));
  // Осмысленные атрибуты на месте.
  assert.ok(result.includes('alt="Дом Идальго — изображение 1"'));
  assert.ok(result.includes('width="1834"'));
  assert.ok(result.includes('height="1440"'));
});

test("в style остаётся всё, кроме курсора", () => {
  const result = prepareRichHtml('<img src="/x.jpg" style="cursor: move; float: left">');
  assert.ok(result.includes('style="float: left"'));
});

test("картинке из uploads добавляется srcset под ширину колонки", () => {
  const result = prepareRichHtml(UPLOADED_IMAGE, { sizes: PROJECT_DESCRIPTION_SIZES });
  assert.ok(result.includes(`sizes="${PROJECT_DESCRIPTION_SIZES}"`));
  assert.ok(
    result.includes("/_next/image?url=%2Fuploads%2Finline-1bbd803a91220671.webp&w=640&q=75 640w"),
  );
  // Ступени крупнее самой картинки не запрашиваем, оригинал оставляем последним кандидатом.
  assert.ok(!result.includes("w=1920"));
  assert.ok(result.includes("/uploads/inline-1bbd803a91220671.webp 1834w"));
});

test("повторный вызов ничего не удваивает", () => {
  const once = prepareRichHtml(UPLOADED_IMAGE, { sizes: ARTICLE_BODY_SIZES });
  assert.equal(prepareRichHtml(once, { sizes: ARTICLE_BODY_SIZES }), once);
});

test("чужие и встроенные картинки не трогаем", () => {
  const external = '<img src="https://example.com/a.jpg" alt="">';
  assert.equal(prepareRichHtml(external).includes("srcset"), false);

  const inline = '<img src="data:image/png;base64,AAAA" alt="">';
  assert.equal(prepareRichHtml(inline).includes("srcset"), false);
});

test("ленивая загрузка добавляется, если редактор её не поставил", () => {
  const result = prepareRichHtml('<img src="/uploads/a.webp" alt="">');
  assert.ok(result.includes('loading="lazy"'));
  assert.ok(result.includes('decoding="async"'));
  assert.equal(result.match(/loading=/g)?.length, 1);
});

test("текст вокруг картинок не меняется", () => {
  const html = '<p>Первый абзац</p>\n<h2>Подзаголовок</h2>\n<ul><li>Пункт</li></ul>';
  assert.equal(prepareRichHtml(html), html);
});
