import assert from "node:assert/strict";
import { test } from "node:test";
import { buildIndexNowRequest, INDEXNOW_KEY, INDEXNOW_KEY_LOCATION } from "../lib/indexnow";

test("пути превращаются в абсолютные адреса сайта", () => {
  const request = buildIndexNowRequest(["/stati/kak-schitaetsya-proekt", "/idalgo"]);
  assert.deepEqual(request?.urlList, [
    "https://rinart.pro/stati/kak-schitaetsya-proekt",
    "https://rinart.pro/idalgo",
  ]);
  assert.equal(request?.host, "rinart.pro");
  assert.equal(request?.key, INDEXNOW_KEY);
  assert.equal(request?.keyLocation, INDEXNOW_KEY_LOCATION);
});

test("ключ лежит файлом на самом сайте", () => {
  assert.equal(INDEXNOW_KEY_LOCATION, `https://rinart.pro/${INDEXNOW_KEY}.txt`);
  assert.match(INDEXNOW_KEY, /^[a-f0-9]{32}$/);
});

test("повторы, пустые строки и чужие домены отсеиваются", () => {
  const request = buildIndexNowRequest([
    "/stati",
    "/stati",
    "https://rinart.pro/stati",
    "   ",
    "https://example.com/stati",
  ]);
  assert.deepEqual(request?.urlList, ["https://rinart.pro/stati"]);
});

test("без адресов уведомление не собирается", () => {
  assert.equal(buildIndexNowRequest([]), null);
  assert.equal(buildIndexNowRequest(["https://example.com/a"]), null);
});

test("за раз отправляем не больше сотни адресов", () => {
  const many = Array.from({ length: 150 }, (_, index) => `/proekt-${index}`);
  assert.equal(buildIndexNowRequest(many)?.urlList.length, 100);
});
