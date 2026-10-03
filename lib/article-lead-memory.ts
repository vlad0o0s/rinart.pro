import type { ArticleLeadMemory } from "./article-lead-modal";

/**
 * Что браузер помнит об окне заявки: открывалось ли оно в этой вкладке, когда его закрыли
 * и когда отсюда ушла заявка. Хранилище бывает недоступно (частный режим, запрет в
 * настройках) — тогда окно ведёт себя так, будто посетитель здесь впервые.
 */

const SHOWN_KEY = "rinart:article-lead-shown";
const DISMISSED_KEY = "rinart:article-lead-dismissed";
const LEAD_SENT_KEY = "rinart:lead-sent";

function readTimestamp(key: string): number | null {
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeTimestamp(key: string) {
  try {
    window.localStorage.setItem(key, String(Date.now()));
  } catch {
    // Без хранилища окно просто покажется ещё раз — заявке это не мешает.
  }
}

export function readArticleLeadMemory(): ArticleLeadMemory {
  let shownThisSession = false;
  try {
    shownThisSession = window.sessionStorage.getItem(SHOWN_KEY) === "1";
  } catch {
    shownThisSession = false;
  }
  return {
    shownThisSession,
    dismissedAt: readTimestamp(DISMISSED_KEY),
    leadSentAt: readTimestamp(LEAD_SENT_KEY),
  };
}

export function markArticleLeadShown() {
  try {
    window.sessionStorage.setItem(SHOWN_KEY, "1");
  } catch {
    // См. writeTimestamp.
  }
}

export function markArticleLeadDismissed() {
  writeTimestamp(DISMISSED_KEY);
}

/** Заявка ушла из любой формы сайта: предлагать её тому же человеку снова незачем. */
export function markLeadSent() {
  writeTimestamp(LEAD_SENT_KEY);
}
