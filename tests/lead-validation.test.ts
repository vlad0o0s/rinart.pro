import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LEAD_LIMITS,
  clampText,
  isValidPhone,
  normalizeAttribution,
  normalizePhone,
  normalizeQuiz,
} from "../lib/lead-validation";

test("телефон приводится к одному виду независимо от того, как его набрали", () => {
  const expected = "+79031474430";

  assert.equal(normalizePhone("+7 (903) 147-44-30"), expected);
  assert.equal(normalizePhone("8 903 147 44 30"), expected);
  assert.equal(normalizePhone("89031474430"), expected);
  assert.equal(normalizePhone("79031474430"), expected);
  assert.equal(normalizePhone("9031474430"), expected);
});

test("неполный или нероссийский номер отбрасывается", () => {
  assert.equal(normalizePhone("+7 903 147"), null);
  assert.equal(normalizePhone("903147443"), null);
  assert.equal(normalizePhone("790314744301"), null);
  // Код страны не 7 и не 8 — это не тот номер, по которому здесь перезванивают.
  assert.equal(normalizePhone("+1 202 555 0143"), null);
  assert.equal(normalizePhone(""), null);
  assert.equal(normalizePhone(null), null);
  assert.equal(normalizePhone(undefined), null);
  assert.equal(normalizePhone(12345678901), null);
});

test("isValidPhone согласован с normalizePhone", () => {
  assert.equal(isValidPhone("+7 (903) 147-44-30"), true);
  assert.equal(isValidPhone("123"), false);
});

test("clampText чистит пробелы, режет длину и не падает на не-строках", () => {
  assert.equal(clampText("  Иван   Петров \n", 80), "Иван Петров");
  assert.equal(clampText("a".repeat(200), 10), "a".repeat(10));
  assert.equal(clampText(undefined, 10), "");
  assert.equal(clampText(42, 10), "");
  assert.equal(clampText({ toString: () => "x" }, 10), "");
});

test("ответы квиза обрезаются по длине", () => {
  const quiz = normalizeQuiz({
    houseType: "Каменный дом (газобетон, кирпич)",
    floors: "Двухэтажный",
    area: "200–300 м²",
    timing: "В ближайшие 3 месяца",
    estimate: "x".repeat(500),
  });

  assert.ok(quiz);
  assert.equal(quiz.area, "200–300 м²");
  assert.equal(quiz.estimate.length, LEAD_LIMITS.estimate);
});

test("пустой или посторонний квиз превращается в null", () => {
  assert.equal(normalizeQuiz(null), null);
  assert.equal(normalizeQuiz("строка"), null);
  assert.equal(normalizeQuiz({}), null);
  assert.equal(normalizeQuiz({ area: "   " }), null);
});

test("в метках рекламы остаются только известные ключи", () => {
  const attribution = normalizeAttribution({
    utm_source: "yandex",
    utm_medium: "cpc",
    utm_campaign: "поиск",
    yclid: "123456789",
    pageUrl: "https://rinart.pro/lp/proekt-doma",
    referrer: "https://yandex.ru/search/",
    // Чужие поля из тела запроса не должны доезжать до уведомления.
    admin: "true",
    name: "Иван",
  });

  assert.deepEqual(attribution, {
    utm_source: "yandex",
    utm_medium: "cpc",
    utm_campaign: "поиск",
    yclid: "123456789",
    pageUrl: "https://rinart.pro/lp/proekt-doma",
    referrer: "https://yandex.ru/search/",
  });
});

test("слишком длинная метка обрезается, мусорный тип игнорируется", () => {
  const attribution = normalizeAttribution({
    utm_campaign: "к".repeat(1000),
    utm_source: { evil: true },
  });

  assert.equal(attribution.utm_campaign?.length, LEAD_LIMITS.utm);
  assert.equal(attribution.utm_source, undefined);
});

test("нормализация меток переживает мусор вместо объекта", () => {
  assert.deepEqual(normalizeAttribution(null), {});
  assert.deepEqual(normalizeAttribution("?utm_source=yandex"), {});
});
