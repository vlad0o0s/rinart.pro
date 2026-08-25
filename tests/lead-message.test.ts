import assert from "node:assert/strict";
import { test } from "node:test";
import { formatLeadLines } from "../lib/lead-message";

const lead = {
  name: "Тест сайта — не перезванивать",
  phone: "+79031474430",
  source: "Лендинг квиз",
  createdAt: "2026-08-25T09:30:00.000Z",
  quiz: {
    houseType: "Каменный дом (газобетон, кирпич)",
    floors: "Двухэтажный",
    area: "200–300 м²",
    timing: "В ближайшие 3 месяца",
    estimate: "740 000 ₽ — 1 380 000 ₽",
  },
  attribution: {
    utm_source: "yandex",
    utm_medium: "cpc",
    utm_campaign: "RINART | Поиск",
    yclid: "1234567890",
    pageUrl: "https://rinart.pro/lp/proekt-doma",
    referrer: "https://yandex.ru/search/",
  },
};

test("уведомление содержит контакты, ответы квиза и метки рекламы", () => {
  const text = formatLeadLines(lead).join("\n");

  // Ради этого всё и делалось: звонок начинается с уже известной задачи.
  assert.match(text, /Каменный дом/);
  assert.match(text, /Двухэтажный/);
  assert.match(text, /200–300 м²/);
  assert.match(text, /В ближайшие 3 месяца/);
  assert.match(text, /740 000 ₽ — 1 380 000 ₽/);

  assert.match(text, /utm_source: yandex/);
  assert.match(text, /utm_medium: cpc/);
  assert.match(text, /utm_campaign: RINART \| Поиск/);
  assert.match(text, /yclid: 1234567890/);
  assert.match(text, /https:\/\/rinart\.pro\/lp\/proekt-doma/);
  assert.match(text, /https:\/\/yandex\.ru\/search\//);

  assert.match(text, /\+79031474430/);
  // Время создания берётся с сервера и показывается по Москве.
  assert.match(text, /Создана: 25\.08\.2026, 12:30 \(МСК\)/);
});

test("непроверенная капчей заявка помечена в первой строке", () => {
  const flagged = formatLeadLines({ ...lead, unverified: true });
  assert.match(flagged[0], /Капча не подтверждена/);

  const clean = formatLeadLines(lead);
  assert.doesNotMatch(clean[0], /Капча/);
});

test("заявка без квиза и меток не ломает сообщение", () => {
  const text = formatLeadLines({
    name: "",
    phone: "+79031474430",
    source: "Контакты",
  }).join("\n");

  assert.match(text, /Имя: не указано/);
  assert.match(text, /Телефон: \+79031474430/);
  assert.doesNotMatch(text, /Ответы квиза/);
  assert.doesNotMatch(text, /Реклама/);
});
