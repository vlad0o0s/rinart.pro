/**
 * Текст для мета-тегов и разметки из HTML описания проекта.
 *
 * Абзацы описания хранятся с разметкой редактора: теги из них уже вырезаются, а сущности
 * (`&nbsp;`, `&laquo;`) и длина оставались как есть — так в сниппет «Бани Эд» попадал
 * сырой текст на пол-экрана. Модуль без зависимостей: его вызывают страницы и тесты.
 */

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  laquo: "«",
  raquo: "»",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  shy: "",
  times: "×",
  sup2: "²",
  sup3: "³",
  deg: "°",
  bull: "•",
  middot: "·",
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1] === "x" || entity[1] === "X" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** HTML → одна строка обычного текста: без тегов, сущностей и лишних пробелов. */
export function plainText(html: string | null | undefined): string {
  if (!html) {
    return "";
  }
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Обрезает текст по границе слова. Многоточие ставится, только если что-то отрезано,
 * а висящие в конце знаки препинания убираются, чтобы не было «…,…».
 */
export function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  const slice = text.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.replace(/[\s,;:.\-–—]+$/u, "")}…`;
}

/** Длина description, которую Яндекс обычно показывает в сниппете целиком. */
export const META_DESCRIPTION_MAX = 160;

/** Описание по первому непустому абзацу — когда в карточке проекта description не задан вручную. */
export function metaDescriptionFrom(paragraphs: Array<string | null | undefined>, max = META_DESCRIPTION_MAX): string | undefined {
  for (const paragraph of paragraphs) {
    const text = plainText(paragraph);
    if (text) {
      return truncateAtWord(text, max);
    }
  }
  return undefined;
}

/** Строка из ручного SEO-поля: пустое или состоящее из пробелов значение считается незаданным. */
export function filledOrUndefined(value: string | null | undefined): string | undefined {
  const text = plainText(value);
  return text ? text : undefined;
}
