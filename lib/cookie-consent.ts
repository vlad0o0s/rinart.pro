/**
 * Выбор посетителя о файлах куки (cookie): что хранится, как читается и что из него следует.
 *
 * Модуль чистый — без React и без обращения к браузеру, поэтому одни и те же правила
 * применяют корневой шаблон на сервере (читает cookie из запроса), счётчик и баннер
 * в браузере и тесты.
 */

/**
 * `granted` — нажал «Принять». `denied` — нажал «Отказаться».
 * `implied` — увидел баннер и продолжил пользоваться сайтом, ничего не нажимая.
 * Записи нет вовсе — человек только что открыл сайт и ещё ничего не сделал.
 */
export type CookieConsentChoice = "granted" | "implied" | "denied";

export type CookieConsent = {
  choice: CookieConsentChoice;
  /** Unix-время выбора в секундах: по нему видно, когда согласие дано. */
  decidedAt: number;
};

/** Собственный файл сайта с выбором посетителя. Он обязательный и согласия не требует. */
export const CONSENT_COOKIE_NAME = "rinart_cookie_consent";

/**
 * Номер набора сервисов, на который человек соглашался. Увеличивается, когда на сайте
 * появляется новый сервис со своими cookie или новая цель обработки: прежнее согласие
 * этого не покрывает, и баннер спрашивает заново. Правка формулировок номер не меняет.
 */
export const CONSENT_SCOPE = 1;

/**
 * Сколько сайт помнит выбор. Нажатие «Принять» — год, столько же живёт идентификатор
 * Метрики. Отказ и согласие без нажатия — полгода, потом баннер напомнит о себе.
 */
const CONSENT_DAYS: Record<CookieConsentChoice, number> = {
  granted: 365,
  implied: 180,
  denied: 180,
};

/** Событие окна: выбор изменился. Счётчик и баннер перечитывают cookie. */
export const CONSENT_CHANGE_EVENT = "rinart:cookie-consent";
/** Событие окна: посетитель нажал «Настройки куки» в подвале. */
export const CONSENT_SETTINGS_EVENT = "rinart:cookie-settings";

/**
 * Когда включается счётчик Метрики и как посетитель даёт согласие.
 *
 * `notice` — счётчик включается при открытии страницы, баннер на первом же экране сообщает
 * об этом. Согласие — нажатие «Принять» или продолжение работы с сайтом после баннера;
 * «Отказаться» выключает счётчик и убирает его файлы. Режим выбран 08.10.2026: в режиме
 * `implied` в Метрику не попадали те, кто ушёл, ничего не тронув, а визит остальных
 * отсчитывался от первого действия — отказы и время на сайте переставали быть сравнимыми
 * с прошлыми периодами, и реклама оценивалась по искажённым данным.
 *
 * `implied` — нажатием «Принять» или тем, что, увидев баннер, продолжил пользоваться
 * сайтом: прокрутил страницу, нажал на что-нибудь, перешёл дальше. Счётчик включается
 * после этого действия, а не при загрузке страницы. Такой способ Роскомнадзор называл
 * допустимым на разъяснениях 2025–2026 годов.
 *
 * `explicit` — только нажатием «Принять». Самый строгий вариант: пока кнопка не нажата,
 * счётчика на странице нет. Цена — в Метрику не попадают все, кто баннер не тронул.
 *
 * Переключение меняет и текст баннера, и документ о куки — они читают эту константу.
 */
export type AnalyticsMode = "notice" | "implied" | "explicit";
export const ANALYTICS_MODE: AnalyticsMode = "notice";

export function serializeConsent(choice: CookieConsentChoice, nowMs: number): string {
  return `${choice}.${CONSENT_SCOPE}.${Math.floor(nowMs / 1000)}`;
}

/** `null` — выбора нет: cookie отсутствует, испорчена или относится к прежнему набору сервисов. */
export function parseConsent(raw: string | null | undefined): CookieConsent | null {
  if (!raw) {
    return null;
  }
  const [choice, scope, decidedAt] = raw.split(".");
  if (choice !== "granted" && choice !== "implied" && choice !== "denied") {
    return null;
  }
  if (Number(scope) !== CONSENT_SCOPE) {
    return null;
  }
  const seconds = Number(decidedAt);
  if (!Number.isInteger(seconds) || seconds <= 0) {
    return null;
  }
  return { choice, decidedAt: seconds };
}

export function consentDays(choice: CookieConsentChoice): number {
  return CONSENT_DAYS[choice];
}

export function consentMaxAgeSeconds(choice: CookieConsentChoice): number {
  return consentDays(choice) * 24 * 60 * 60;
}

export function isAnalyticsAllowed(consent: CookieConsent | null, mode: AnalyticsMode = ANALYTICS_MODE): boolean {
  if (!consent) {
    // Выбора ещё нет: счётчик работает только в режиме, где он включается при открытии страницы.
    return mode === "notice";
  }
  if (consent.choice === "granted") {
    return true;
  }
  // Согласие без нажатия действует только в режимах, где оно предусмотрено.
  return consent.choice === "implied" && mode !== "explicit";
}

/**
 * Нужно ли показывать баннер. Согласие без нажатия, оставшееся от мягкого режима,
 * в строгом выбором не считается — баннер спросит ещё раз.
 */
export function needsDecision(consent: CookieConsent | null, mode: AnalyticsMode = ANALYTICS_MODE): boolean {
  if (!consent) {
    return true;
  }
  return consent.choice === "implied" && mode === "explicit";
}

/** Строка для `document.cookie`. `Secure` — только по https: на локальном стенде его нет. */
export function buildConsentCookie(choice: CookieConsentChoice, nowMs: number, secure: boolean): string {
  return [
    `${CONSENT_COOKIE_NAME}=${serializeConsent(choice, nowMs)}`,
    "Path=/",
    `Max-Age=${consentMaxAgeSeconds(choice)}`,
    "SameSite=Lax",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

/** Значение нужной cookie из строки `document.cookie` или заголовка Cookie. */
export function readCookieValue(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) {
      continue;
    }
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return null;
}

/**
 * Отметка в хранилище вкладки: счётчик в ней уже запускался. Ставится вместе с запуском
 * счётчика и снимается при отказе.
 */
export const ANALYTICS_STARTED_KEY = "rinart-ym-started";

/** Файлы и записи хранилища, которые создаёт Яндекс Метрика. При отказе их убираем. */
export function isMetrikaCookieName(name: string): boolean {
  return name.startsWith("_ym") || name === "mdd" || name === "yandexuid" || name === "ymex";
}

export function isMetrikaStorageKey(key: string): boolean {
  return key.startsWith("_ym") || key.startsWith("__ym") || key === ANALYTICS_STARTED_KEY;
}
