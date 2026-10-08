import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ANALYTICS_STARTED_KEY,
  CONSENT_COOKIE_NAME,
  CONSENT_SCOPE,
  buildConsentCookie,
  consentDays,
  consentMaxAgeSeconds,
  isAnalyticsAllowed,
  isMetrikaCookieName,
  isMetrikaStorageKey,
  needsDecision,
  parseConsent,
  readCookieValue,
  serializeConsent,
} from "../lib/cookie-consent";

const NOW = Date.UTC(2026, 9, 4, 12, 0, 0);

const granted = parseConsent(serializeConsent("granted", NOW));
const implied = parseConsent(serializeConsent("implied", NOW));
const denied = parseConsent(serializeConsent("denied", NOW));

test("выбор записывается и читается обратно", () => {
  assert.deepEqual(granted, { choice: "granted", decidedAt: NOW / 1000 });
  assert.equal(implied?.choice, "implied");
  assert.equal(denied?.choice, "denied");
});

test("пустая, испорченная и чужая cookie — выбора нет, баннер спросит заново", () => {
  for (const raw of [undefined, null, "", "yes", "granted", "granted.1", "granted.1.abc", "granted.1.-5", "maybe.1.1790000000"]) {
    assert.equal(parseConsent(raw), null, String(raw));
  }
});

test("согласие на прежний набор сервисов не действует после его изменения", () => {
  assert.equal(parseConsent(`granted.${CONSENT_SCOPE + 1}.1790000000`), null);
});

test("режим уведомления: счётчик работает с открытия страницы, пока человек не отказался", () => {
  assert.equal(isAnalyticsAllowed(null, "notice"), true, "выбора ещё нет — счётчик уже работает");
  assert.equal(isAnalyticsAllowed(granted, "notice"), true);
  assert.equal(isAnalyticsAllowed(implied, "notice"), true);
  assert.equal(isAnalyticsAllowed(denied, "notice"), false, "отказ выключает счётчик");

  assert.equal(needsDecision(null, "notice"), true, "баннер показывается, пока выбора нет");
  assert.equal(needsDecision(implied, "notice"), false);
  assert.equal(needsDecision(denied, "notice"), false);
});

test("мягкий режим: счётчик включается после нажатия «Принять» или продолжения работы с сайтом", () => {
  assert.equal(isAnalyticsAllowed(null, "implied"), false, "пока человек ничего не сделал, счётчика нет");
  assert.equal(isAnalyticsAllowed(granted, "implied"), true);
  assert.equal(isAnalyticsAllowed(implied, "implied"), true);
  assert.equal(isAnalyticsAllowed(denied, "implied"), false);

  assert.equal(needsDecision(null, "implied"), true);
  assert.equal(needsDecision(implied, "implied"), false, "согласие действием — это выбор, баннер больше не нужен");
  assert.equal(needsDecision(denied, "implied"), false);
});

test("строгий режим: счётчик включается только нажатием «Принять»", () => {
  assert.equal(isAnalyticsAllowed(null, "explicit"), false);
  assert.equal(isAnalyticsAllowed(granted, "explicit"), true);
  assert.equal(isAnalyticsAllowed(denied, "explicit"), false);

  // Согласие действием осталось от мягкого режима: в строгом оно не действует.
  assert.equal(isAnalyticsAllowed(implied, "explicit"), false);
  assert.equal(needsDecision(implied, "explicit"), true, "баннер спрашивает ещё раз");
  assert.equal(needsDecision(granted, "explicit"), false);
});

test("cookie выбора: срок, путь и защита", () => {
  const cookie = buildConsentCookie("granted", NOW, true);
  assert.ok(cookie.startsWith(`${CONSENT_COOKIE_NAME}=granted.${CONSENT_SCOPE}.${NOW / 1000};`), cookie);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, new RegExp(`Max-Age=${365 * 24 * 60 * 60}`));

  // На локальном стенде по http признака Secure нет — иначе браузер cookie не сохранит.
  assert.doesNotMatch(buildConsentCookie("denied", NOW, false), /Secure/);

  // Нажатие «Принять» помним дольше, чем отказ и согласие действием.
  assert.ok(consentDays("denied") < consentDays("granted"));
  assert.ok(consentDays("implied") < consentDays("granted"));
  assert.equal(consentMaxAgeSeconds("implied"), consentDays("implied") * 86400);
});

test("значение читается из строки с несколькими cookie", () => {
  const header = `_ym_uid=1790000000123; ${CONSENT_COOKIE_NAME}=denied.${CONSENT_SCOPE}.1790000000; other=1`;
  assert.equal(readCookieValue(header, CONSENT_COOKIE_NAME), `denied.${CONSENT_SCOPE}.1790000000`);
  assert.equal(readCookieValue(header, "missing"), null);
  assert.equal(readCookieValue("", CONSENT_COOKIE_NAME), null);
});

test("при отказе убираются только записи Метрики", () => {
  for (const name of ["_ym_uid", "_ym_d", "_ym_isad", "_ym_visorc", "mdd"]) {
    assert.equal(isMetrikaCookieName(name), true, name);
  }
  assert.equal(isMetrikaCookieName(CONSENT_COOKIE_NAME), false, "собственный выбор посетителя остаётся");

  assert.equal(isMetrikaStorageKey("_ym_uid"), true);
  assert.equal(isMetrikaStorageKey("__ym_tab_guid"), true);
  assert.equal(isMetrikaStorageKey(ANALYTICS_STARTED_KEY), true, "отметка о запуске счётчика уходит вместе с ним");
  assert.equal(isMetrikaStorageKey("rinart-lead-attribution"), false, "метки заявки не трогаем");
  assert.equal(isMetrikaStorageKey("rinart:lead-sent"), false);
});
