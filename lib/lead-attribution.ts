"use client";

/**
 * Метки рекламы живут в адресе только на первом экране: пока человек проходит квиз,
 * роутер успевает переписать URL, и к моменту отправки формы `utm_*` и `yclid` уже нет.
 * Поэтому запоминаем их один раз за вкладку в sessionStorage — это first-party хранилище,
 * оно не переживает закрытие вкладки и не требует согласия на cookie.
 *
 * Здесь нет и не должно быть имени и телефона: хранилище переживает переходы по сайту,
 * персональные данные в нём не нужны.
 */

import { UTM_KEYS, type Attribution } from "./lead-validation";

const STORAGE_KEY = "rinart-lead-attribution";

type StoredAttribution = Attribution;

function readStore(): StoredAttribution {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as StoredAttribution) : {};
  } catch {
    // Приватный режим или отключённое хранилище — не повод ронять форму.
    return {};
  }
}

function writeStore(value: StoredAttribution) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Тот же случай: без хранилища заявка просто уйдёт без меток.
  }
}

/**
 * Забирает метки из текущего адреса. Вызывать как можно раньше на странице входа.
 *
 * Существующие метки не затираются пустыми: переход внутри сайта без `utm_*` не должен
 * стирать источник рекламного клика. Но новый клик с новыми метками важнее старых —
 * их записываем поверх.
 */
export function captureAttribution() {
  if (typeof window === "undefined") {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const stored = readStore();
  const next: StoredAttribution = { ...stored };
  let hasFreshMarks = false;

  for (const key of UTM_KEYS) {
    const value = params.get(key)?.trim();
    if (value) {
      next[key] = value;
      hasFreshMarks = true;
    }
  }

  const yclid = params.get("yclid")?.trim();
  if (yclid) {
    next.yclid = yclid;
    hasFreshMarks = true;
  }

  // Реферер интересен внешний — тот, с которого человек пришёл на сайт.
  // Переходы между своими страницами его только затирают.
  if (!next.referrer) {
    const referrer = document.referrer;
    if (referrer && !referrer.startsWith(window.location.origin)) {
      next.referrer = referrer;
    }
  }

  // Страница входа — первая страница вкладки. Переходы по сайту её не меняют,
  // а новый рекламный клик начинает визит заново — вместе с метками обновляем и её.
  if (!next.landingPage || hasFreshMarks) {
    next.landingPage = window.location.pathname;
  }

  if (hasFreshMarks || next.referrer !== stored.referrer || next.landingPage !== stored.landingPage) {
    writeStore(next);
  }
}

/** Метки для отправки вместе с заявкой. URL берём текущий — это страница отправки. */
export function readAttribution(): Attribution {
  if (typeof window === "undefined") {
    return {};
  }

  const stored = readStore();

  return {
    ...stored,
    // Без query-строки: в ней нет ничего, чего мы уже не сохранили отдельными полями,
    // зато туда легко попадают чужие параметры.
    pageUrl: `${window.location.origin}${window.location.pathname}`,
  };
}
