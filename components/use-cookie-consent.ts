"use client";

import { useSyncExternalStore } from "react";
import {
  CONSENT_CHANGE_EVENT,
  CONSENT_COOKIE_NAME,
  buildConsentCookie,
  isAnalyticsAllowed,
  isMetrikaCookieName,
  isMetrikaStorageKey,
  parseConsent,
  readCookieValue,
  type CookieConsent,
  type CookieConsentChoice,
} from "@/lib/cookie-consent";

/**
 * Выбор посетителя о файлах куки в браузере.
 *
 * Источник правды — сама cookie: её же читает сервер, чтобы первая отрисовка страницы
 * совпала с тем, что увидит браузер. Счётчик и баннер подписаны на одно событие окна,
 * поэтому согласие запускает Метрику без перезагрузки страницы.
 */

/** useSyncExternalStore сравнивает снимки по ссылке — тот же выбор должен давать тот же объект. */
let cachedRaw: string | null | undefined;
let cachedConsent: CookieConsent | null = null;

function readConsent(): CookieConsent | null {
  const raw = readCookieValue(document.cookie, CONSENT_COOKIE_NAME);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedConsent = parseConsent(raw);
  }
  return cachedConsent;
}

function subscribe(onChange: () => void) {
  window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
}

/**
 * `initial` — выбор, который сервер прочитал из запроса. При гидрации он совпадает
 * с cookie в браузере, поэтому разметка сервера и клиента не расходится.
 */
export function useCookieConsent(initial: CookieConsent | null): CookieConsent | null {
  return useSyncExternalStore(subscribe, readConsent, () => initial);
}

export function saveCookieConsent(choice: CookieConsentChoice) {
  document.cookie = buildConsentCookie(choice, Date.now(), window.location.protocol === "https:");
  if (isAnalyticsAllowed(readConsent())) {
    ensureMetrikaQueue();
  }
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
}

type MetrikaQueue = ((...args: unknown[]) => void) & { a?: unknown[]; l?: number };

/**
 * Очередь вызовов Метрики — та же, что создаёт код счётчика, только раньше него.
 *
 * Согласие часто даётся тем же нажатием, которое отправляет цель: человек касается ответа
 * в расчёте стоимости, и это его первое действие на странице. Код счётчика React вставит
 * мгновением позже — без очереди цель этого нажатия потерялась бы. Код счётчика очередь
 * не пересоздаёт, а счётчик после загрузки разбирает её по порядку.
 */
function ensureMetrikaQueue() {
  const holder = window as unknown as { ym?: MetrikaQueue };
  if (typeof holder.ym === "function") {
    return;
  }
  const queue: MetrikaQueue = (...args: unknown[]) => {
    (queue.a = queue.a || []).push(args);
  };
  queue.l = Date.now();
  holder.ym = queue;
}

/**
 * Убирает то, что Метрика успела сохранить в браузере: её cookie на домене сайта и записи
 * в хранилищах. Вызывается при отказе после ранее данного согласия.
 */
export function clearAnalyticsTraces() {
  const host = window.location.hostname;
  // Метрика ставит cookie на основной домен с точкой; на всякий случай снимаем оба варианта.
  const domains = ["", `; Domain=${host}`, `; Domain=.${host.replace(/^www\./, "")}`];

  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim();
    if (!name || !isMetrikaCookieName(name)) {
      continue;
    }
    for (const domain of domains) {
      document.cookie = `${name}=; Path=/; Max-Age=0${domain}`;
    }
  }

  // Само обращение к хранилищу в частном режиме бросает исключение — поэтому оно внутри try.
  for (const pick of [() => window.localStorage, () => window.sessionStorage]) {
    try {
      const storage = pick();
      const keys: string[] = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key && isMetrikaStorageKey(key)) {
          keys.push(key);
        }
      }
      keys.forEach((key) => storage.removeItem(key));
    } catch {
      // Хранилище недоступно (частный режим) — значит, и записей Метрики в нём нет.
    }
  }
}
