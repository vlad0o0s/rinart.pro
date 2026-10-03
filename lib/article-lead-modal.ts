/**
 * Окно заявки в статьях: настройки, тексты по умолчанию и правила показа.
 *
 * Читатель статьи пришёл из поиска за ответом, а не за услугой, и до кнопки под текстом
 * доходит не каждый. Поэтому заявку ему предлагают трижды, от мягкого к настойчивому:
 * блок в середине текста, окно, которое открывается само после вдумчивого чтения,
 * и форма под статьёй. Окно не появляется при входе на страницу и не перекрывает текст
 * тому, кто только начал читать, — иначе оно мешает и читателю, и оценке страницы поиском.
 *
 * Модуль без базы, без next и без React: его вызывают страница, роут админки,
 * компоненты в браузере и тесты.
 */

export type ArticleLeadModalSettings = {
  /** Открывать окно само, когда читатель дочитал до середины. */
  autoOpen: boolean;
  title: string;
  text: string;
  submitLabel: string;
  /** Показывать блок с кнопкой в середине текста. */
  inlineCta: boolean;
  inlineText: string;
  inlineButton: string;
};

export const ARTICLE_LEAD_MODAL_DEFAULTS: ArticleLeadModalSettings = {
  autoOpen: true,
  title: "Обсудим ваш будущий дом?",
  text: "Оставьте телефон — архитектор перезвонит, ответит на вопросы по теме статьи и подскажет, с чего начать проект.",
  submitLabel: "Обсудить проект",
  inlineCta: true,
  inlineText: "Планируете дом? Расскажите о задаче — архитектор ответит на вопросы и сориентирует по срокам и стоимости проекта.",
  inlineButton: "Обсудить проект с архитектором",
};

export const ARTICLE_LEAD_MODAL_LIMITS = {
  title: 80,
  text: 240,
  submitLabel: 40,
  inlineText: 240,
  inlineButton: 50,
} as const;

function text(value: unknown, max: number, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const cleaned = value.replace(/\s+/g, " ").trim().slice(0, max).trim();
  // Пустое поле в админке значит «вернуть текст по умолчанию», а не окно без заголовка.
  return cleaned || fallback;
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Настройки из базы или из формы админки: всё лишнее отбрасывается, пустое заменяется умолчанием. */
export function sanitizeArticleLeadModalSettings(raw: unknown): ArticleLeadModalSettings {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const defaults = ARTICLE_LEAD_MODAL_DEFAULTS;
  return {
    autoOpen: flag(source.autoOpen, defaults.autoOpen),
    title: text(source.title, ARTICLE_LEAD_MODAL_LIMITS.title, defaults.title),
    text: text(source.text, ARTICLE_LEAD_MODAL_LIMITS.text, defaults.text),
    submitLabel: text(source.submitLabel, ARTICLE_LEAD_MODAL_LIMITS.submitLabel, defaults.submitLabel),
    inlineCta: flag(source.inlineCta, defaults.inlineCta),
    inlineText: text(source.inlineText, ARTICLE_LEAD_MODAL_LIMITS.inlineText, defaults.inlineText),
    inlineButton: text(source.inlineButton, ARTICLE_LEAD_MODAL_LIMITS.inlineButton, defaults.inlineButton),
  };
}

/* ---------- Когда окно открывается само ---------- */

/** Сколько секунд человек должен провести на странице, прежде чем окно может открыться. */
export const AUTO_OPEN_MIN_SECONDS = 30;
/** Какую долю текста статьи нужно пролистать. */
export const AUTO_OPEN_SCROLL_SHARE = 0.6;
/** Уход курсора к вкладкам браузера считается намерением уйти не раньше этого времени. */
export const EXIT_INTENT_MIN_SECONDS = 20;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Закрыл окно — не показываем его снова неделю. */
export const DISMISS_SNOOZE_MS = 7 * DAY_MS;
/** Оставил заявку — не предлагаем её снова три месяца. */
export const LEAD_SENT_SNOOZE_MS = 90 * DAY_MS;

export type ArticleLeadMemory = {
  /** Окно уже открывалось само в этой вкладке. */
  shownThisSession: boolean;
  /** Когда посетитель в последний раз закрыл окно, не отправив заявку. */
  dismissedAt: number | null;
  /** Когда с этого браузера в последний раз ушла заявка — из любой формы сайта. */
  leadSentAt: number | null;
};

/** Можно ли окну открыться самому. Открытие по кнопке или ссылке эти ограничения не трогают. */
export function canAutoOpen(memory: ArticleLeadMemory, now: number): boolean {
  if (memory.shownThisSession) {
    return false;
  }
  if (memory.leadSentAt !== null && now - memory.leadSentAt < LEAD_SENT_SNOOZE_MS) {
    return false;
  }
  if (memory.dismissedAt !== null && now - memory.dismissedAt < DISMISS_SNOOZE_MS) {
    return false;
  }
  return true;
}

/** Дочитал ли человек до нужного места: сколько текста статьи уже прошло через экран. */
export function readingShare(articleTop: number, articleHeight: number, viewportBottom: number): number {
  if (articleHeight <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, (viewportBottom - articleTop) / articleHeight));
}

/* ---------- Откуда пришла заявка ---------- */

export type ArticleLeadTrigger = "scroll" | "exit" | "inline" | "link";

const TRIGGER_LABELS: Record<ArticleLeadTrigger, string> = {
  scroll: "окно при чтении",
  exit: "окно при уходе",
  inline: "блок в тексте",
  link: "ссылка в тексте",
};

/**
 * Метка места заявки. Способ стоит перед заголовком: метка обрезается до 200 знаков,
 * и у статьи с длинным заголовком пропал бы именно способ.
 */
export function articleLeadSource(articleTitle: string, trigger: ArticleLeadTrigger): string {
  return `Статья (${TRIGGER_LABELS[trigger]}): ${articleTitle}`;
}

/** Ссылка с таким адресом в тексте статьи открывает окно заявки. */
export const ARTICLE_LEAD_HASH = "#zayavka";
/** Событие, которым блок в тексте просит окно открыться. */
export const ARTICLE_LEAD_EVENT = "rinart:article-lead";

/* ---------- Блок в середине текста ---------- */

/** Короткой статье блок посреди текста не нужен: форма под ней и так рядом. */
const INLINE_CTA_MIN_TEXT = 2500;
/** Блок ставится перед подзаголовком, ближайшим к середине, но не в самом начале и не в конце. */
const INLINE_CTA_FROM = 0.3;
const INLINE_CTA_TO = 0.75;

/** Блочные теги, внутри которых резать текст нельзя. */
const CONTAINERS = new Set(["div", "ul", "ol", "blockquote", "table", "section", "article", "figure", "details"]);

function plainLength(html: string): number {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().length;
}

/** Открыт ли к этой позиции какой-нибудь блочный тег: резать можно только на верхнем уровне. */
function insideContainer(html: string, position: number): boolean {
  const tag = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(html)) !== null && match.index < position) {
    if (!CONTAINERS.has(match[2].toLowerCase())) {
      continue;
    }
    depth += match[1] ? -1 : 1;
    if (depth < 0) {
      depth = 0;
    }
  }
  return depth > 0;
}

/**
 * Делит текст статьи на две части по подзаголовку, ближайшему к середине, — между ними
 * страница ставит блок с кнопкой. Возвращает null, если статья короткая или подходящего
 * подзаголовка нет: тогда текст выводится целиком, как раньше.
 */
export function splitArticleHtml(html: string): { before: string; after: string } | null {
  const total = plainLength(html ?? "");
  if (total < INLINE_CTA_MIN_TEXT) {
    return null;
  }

  const heading = /<h2[\s>]/gi;
  let best: { index: number; distance: number } | null = null;
  let match: RegExpExecArray | null;
  while ((match = heading.exec(html)) !== null) {
    const share = plainLength(html.slice(0, match.index)) / total;
    if (share < INLINE_CTA_FROM || share > INLINE_CTA_TO || insideContainer(html, match.index)) {
      continue;
    }
    const distance = Math.abs(share - 0.5);
    if (!best || distance < best.distance) {
      best = { index: match.index, distance };
    }
  }

  if (!best) {
    return null;
  }
  return { before: html.slice(0, best.index), after: html.slice(best.index) };
}
