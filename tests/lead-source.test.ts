import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyLeadSource } from "../lib/lead-source";
import { moscowMonthKey, summarizeLeads } from "../lib/lead-stats";
import { normalizeAttribution } from "../lib/lead-validation";

test("переход из поиска Яндекса без меток — органика Яндекса", () => {
  assert.equal(classifyLeadSource({ referrer: "https://yandex.ru/" }), "yandex");
  assert.equal(classifyLeadSource({ referrer: "https://ya.ru/" }), "yandex");
  assert.equal(classifyLeadSource({ referrer: "https://www.yandex.kz/search/?text=x" }), "yandex");
});

test("реклама определяется по меткам, даже если реферер — Яндекс", () => {
  assert.equal(classifyLeadSource({ referrer: "https://yandex.ru/", yclid: "123" }), "ads");
  assert.equal(classifyLeadSource({ utm_source: "yandex", utm_medium: "cpc" }), "ads");
});

test("Карты отличимы от поиска только по меткам или по пути в реферере", () => {
  assert.equal(classifyLeadSource({ referrer: "https://yandex.ru/maps/org/rinart/84699529935/" }), "yandex-maps");
  assert.equal(classifyLeadSource({ utm_source: "yandex_maps" }), "yandex-maps");
});

test("прочие сервисы Яндекса — не поиск", () => {
  assert.equal(classifyLeadSource({ referrer: "https://mail.yandex.ru/" }), "referral");
  assert.equal(classifyLeadSource({ referrer: "https://dzen.ru/rinartburo" }), "social");
});

test("остальные источники", () => {
  assert.equal(classifyLeadSource({ referrer: "https://www.google.com/" }), "google");
  assert.equal(classifyLeadSource({ referrer: "https://www.bing.com/search?q=x" }), "search-other");
  assert.equal(classifyLeadSource({ referrer: "https://vk.com/rinart_buro" }), "social");
  assert.equal(classifyLeadSource({ referrer: "https://www.pinterest.com/rinart_buro/" }), "social");
  assert.equal(classifyLeadSource({ utm_source: "telegram", utm_medium: "social" }), "social");
  assert.equal(classifyLeadSource({ utm_source: "newsletter", utm_medium: "email" }), "tagged");
  assert.equal(classifyLeadSource({ referrer: "https://archi.ru/russia/102258/dom-v-dospekhakh" }), "referral");
  assert.equal(classifyLeadSource({ referrer: "не адрес" }), "referral");
  assert.equal(classifyLeadSource({ pageUrl: "https://rinart.pro/kontakty" }), "direct");
  assert.equal(classifyLeadSource(undefined), "direct");
});

test("страница входа принимается только как путь внутри сайта", () => {
  assert.equal(normalizeAttribution({ landingPage: "/idalgo" }).landingPage, "/idalgo");
  assert.equal(normalizeAttribution({ landingPage: "https://evil.example/" }).landingPage, undefined);
  assert.equal(normalizeAttribution({ landingPage: "//evil.example" }).landingPage, undefined);
  assert.equal(normalizeAttribution({ landingPage: 42 }).landingPage, undefined);
});

test("месяц считается по московскому времени", () => {
  // 31 августа 22:30 UTC — в Москве уже 1 сентября.
  assert.equal(moscowMonthKey("2026-08-31T22:30:00.000Z"), "2026-09");
  assert.equal(moscowMonthKey("2026-08-31T20:30:00.000Z"), "2026-08");
  assert.equal(moscowMonthKey("не дата"), null);
});

test("сводка: по месяцам и источникам, без проверочных заявок", () => {
  const summary = summarizeLeads([
    { createdAt: "2026-09-10T10:00:00.000Z", attribution: { referrer: "https://yandex.ru/" } },
    { createdAt: "2026-09-11T10:00:00.000Z", attribution: { yclid: "1" } },
    { createdAt: "2026-09-12T10:00:00.000Z", attribution: { yclid: "2" }, isTest: true },
    { createdAt: "2026-08-02T10:00:00.000Z" },
    { createdAt: "сломанная дата" },
  ]);

  assert.equal(summary.testCount, 1);
  assert.deepEqual(
    summary.months.map((row) => [row.month, row.total]),
    [
      ["2026-09", 2],
      ["2026-08", 1],
    ],
  );
  assert.equal(summary.months[0].bySource.yandex, 1);
  assert.equal(summary.months[0].bySource.ads, 1);
  assert.equal(summary.months[1].bySource.direct, 1);
});
