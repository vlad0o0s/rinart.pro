// Категории портфолио и подписи к картинкам. Раньше жили внутри клиентского компонента
// главной; теперь нужны ещё и странице проектирования, где выводятся те же кейсы.

export type CategoryId = "houses" | "interior" | "art" | "other";

const CATEGORY_ALT_LABELS: Record<CategoryId, string> = {
  houses: "проект частного дома",
  interior: "дизайн-проект интерьера",
  art: "арт-объект",
  other: "проект строения",
};

/** Приводит категории из базы к четырём рабочим значениям. */
export function normalizeCategories(list: string[]): CategoryId[] {
  const mapping: Record<string, CategoryId> = {
    houses: "houses",
    house: "houses",
    interior: "interior",
    interiors: "interior",
    art: "art",
    other: "other",
    misc: "other",
  };

  return list
    .map((item) => mapping[item as keyof typeof mapping] ?? null)
    .filter(Boolean) as CategoryId[];
}

/**
 * Подпись к картинке карточки: название проекта и тип объекта. По ней поиск по картинкам
 * понимает, что изображено, — пустой alt не говорил ничего.
 */
export function portfolioImageAlt(title: string, categories: string[]): string {
  const [first] = normalizeCategories(categories);
  const type = first ? CATEGORY_ALT_LABELS[first] : null;
  // Названия в базе бывают с пробелом в начале — в alt он не нужен.
  const name = title.trim();
  return type ? `${name} — ${type}, бюро RINART` : `${name} — проект бюро RINART`;
}
