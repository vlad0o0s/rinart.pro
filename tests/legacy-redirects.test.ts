import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveLegacyRedirect } from "../legacy-redirects.cjs";

test("старые адреса WordPress ведут на действующие кейсы одним переходом — со слешем и без", () => {
  assert.equal(resolveLegacyRedirect("/2024/09/07/dom-idalgo/"), "/idalgo");
  assert.equal(resolveLegacyRedirect("/2024/09/07/dom-idalgo"), "/idalgo");
  assert.equal(resolveLegacyRedirect("/2024/08/24/dom-ozerskoe/"), "/ozerskoe");
  assert.equal(resolveLegacyRedirect("/2025/09/25/aznakaevo/"), "/aznakaevo");
  assert.equal(resolveLegacyRedirect("/portfolio/"), "/");
  assert.equal(resolveLegacyRedirect("/portfolio"), "/");
});

test("ранний маршрут /projects/<slug> ведёт на адрес проекта", () => {
  assert.equal(resolveLegacyRedirect("/projects/idalgo"), "/idalgo");
  assert.equal(resolveLegacyRedirect("/projects/16-uslanka/"), "/16-uslanka");
  // Админское API содержит тот же сегмент, но начинается не с него.
  assert.equal(resolveLegacyRedirect("/api/admin/projects/idalgo"), null);
  assert.equal(resolveLegacyRedirect("/projects"), null);
  assert.equal(resolveLegacyRedirect("/projects/a/b"), null);
});

test("адрес проекта не может увести на чужой домен", () => {
  assert.equal(resolveLegacyRedirect("/projects/\\evil.com"), null);
  assert.equal(resolveLegacyRedirect("/projects//evil.com"), null);
  assert.equal(resolveLegacyRedirect("/projects/%2F%2Fevil.com"), null);
  assert.equal(resolveLegacyRedirect("//evil.com/portfolio"), null);
});

test("короткие ссылки WordPress ?p= ведут на свои страницы, параметр p снимается", () => {
  assert.equal(resolveLegacyRedirect("/?p=23"), "/proektirovanie");
  assert.equal(resolveLegacyRedirect("/?p=33"), "/masterskaja");
  assert.equal(resolveLegacyRedirect("/?p=35"), "/kontakty");
  assert.equal(resolveLegacyRedirect("/?p=31"), "/");
  assert.equal(resolveLegacyRedirect("/?utm_source=x&p=23"), "/proektirovanie?utm_source=x");
  // Неизвестные записи остаются главной: Яндекс уже считает их её неканоническими копиями.
  assert.equal(resolveLegacyRedirect("/?p=1523"), null);
  assert.equal(resolveLegacyRedirect("/kontakty?p=23"), null);
});

test("метки в старом адресе сохраняются", () => {
  assert.equal(resolveLegacyRedirect("/2024/09/07/dom-idalgo/?utm_source=trezzini"), "/idalgo?utm_source=trezzini");
});

test("действующие и снятые адреса не трогаем", () => {
  for (const url of ["/", "/idalgo", "/kontakty/", "/proektirovanie", "/ilichevka", "/dom-ilichevka", "/category/all/", "/_next/static/chunks/a.js", "/?utm_source=x"]) {
    assert.equal(resolveLegacyRedirect(url), null, url);
  }
});
