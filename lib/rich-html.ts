// Описания кейсов и тексты статей хранятся в базе готовым HTML из редактора админки.
// Перед выводом на сайт с ним нужно сделать две вещи.
//
// 1. Убрать служебные атрибуты редактора. Вместе с текстом сохранялись draggable="true"
//    и style="cursor: move" — на сайте посетитель видел курсор перетаскивания над
//    картинкой описания, хотя перетаскивать там нечего.
// 2. Добавить картинкам srcset. Перенесённые из base64 файлы лежат в исходном размере
//    (до 2560 пикселей), а в вёрстке занимают 355 пикселей на телефоне и 494 на десктопе:
//    браузер тянул полный файл и на том, и на другом.
//
// Разбор строкой, а не через DOM: модуль работает на сервере, где document нет,
// а разметка своя — её пишет редактор админки, а не внешний источник.

import { RESPONSIVE_WIDTHS } from "./image-srcset";

/** Колонка описания кейса: до 1024 пикселей почти во весь экран, дальше — треть ширины. */
export const PROJECT_DESCRIPTION_SIZES = "(max-width: 1023px) 95vw, 35vw";

/** Колонка статьи ограничена 760 пикселями. */
export const ARTICLE_BODY_SIZES = "(max-width: 800px) 100vw, 760px";

type PrepareOptions = {
  /** Значение атрибута sizes — зависит от того, в какой колонке выводится текст. */
  sizes?: string;
};

// Атрибут вида name="value", name='value' или name=value.
const ATTRIBUTE = String.raw`\s+[a-zA-Z_:@.-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s">]+))?`;
const IMG_TAG = new RegExp(String.raw`<img(?:${ATTRIBUTE})*\s*/?>`, "gi");

function readAttribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(String.raw`\s${name}\s*=\s*"([^"]*)"`, "i"));
  return match ? match[1] : null;
}

function hasAttribute(tag: string, name: string): boolean {
  return new RegExp(String.raw`\s${name}(\s|=|>|/)`, "i").test(tag);
}

function dropAttribute(tag: string, name: string): string {
  return tag.replace(
    new RegExp(String.raw`\s${name}(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s">]+))?`, "gi"),
    "",
  );
}

/** Убирает из style объявления курсора, а пустой атрибут удаляет целиком. */
function cleanStyle(tag: string): string {
  const style = readAttribute(tag, "style");
  if (style === null) {
    return tag;
  }

  const kept = style
    .split(";")
    .map((declaration) => declaration.trim())
    .filter((declaration) => declaration.length > 0 && !/^cursor\s*:/i.test(declaration));

  if (!kept.length) {
    return dropAttribute(tag, "style");
  }

  return tag.replace(/\sstyle\s*=\s*"[^"]*"/i, ` style="${kept.join("; ")}"`);
}

function addAttribute(tag: string, attribute: string): string {
  const selfClosing = /\/>$/.test(tag);
  return `${tag.slice(0, selfClosing ? -2 : -1).trimEnd()} ${attribute}${selfClosing ? " />" : ">"}`;
}

/**
 * srcset для картинки из /uploads: ступени берём общие с остальным сайтом, но не крупнее
 * самой картинки, а последним кандидатом оставляем оригинал — чтобы на большом экране
 * ничего не потерять.
 */
function buildContentSrcSet(src: string, naturalWidth: number | null): string {
  const steps = naturalWidth
    ? RESPONSIVE_WIDTHS.filter((width) => width < naturalWidth)
    : [...RESPONSIVE_WIDTHS];

  const candidates = steps.map(
    (width) => `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75 ${width}w`,
  );

  if (naturalWidth) {
    candidates.push(`${src} ${naturalWidth}w`);
  }

  return candidates.join(", ");
}

function prepareImage(tag: string, sizes: string): string {
  let result = cleanStyle(dropAttribute(dropAttribute(tag, "draggable"), "contenteditable"));

  if (!hasAttribute(result, "loading")) {
    result = addAttribute(result, 'loading="lazy"');
  }
  if (!hasAttribute(result, "decoding")) {
    result = addAttribute(result, 'decoding="async"');
  }

  const src = readAttribute(result, "src");
  // Оптимизатор Next работает с нашими файлами; внешние картинки и data: не трогаем.
  if (!src || !src.startsWith("/uploads/") || hasAttribute(result, "srcset")) {
    return result;
  }

  const widthAttribute = readAttribute(result, "width");
  const naturalWidth = widthAttribute && /^\d+$/.test(widthAttribute) ? Number(widthAttribute) : null;
  const srcSet = buildContentSrcSet(src, naturalWidth);
  if (!srcSet) {
    return result;
  }

  return addAttribute(result, `srcset="${srcSet}" sizes="${sizes}"`);
}

/** Готовит сохранённый в базе HTML к выводу на сайте. */
export function prepareRichHtml(html: string, options: PrepareOptions = {}): string {
  if (!html) {
    return html;
  }

  const sizes = options.sizes ?? "100vw";
  return html
    .replace(IMG_TAG, (tag) => prepareImage(tag, sizes))
    .replace(/\sdraggable\s*=\s*(?:"[^"]*"|'[^']*'|[^\s">]+)/gi, "")
    .replace(/\scontenteditable\s*=\s*(?:"[^"]*"|'[^']*'|[^\s">]+)/gi, "");
}
