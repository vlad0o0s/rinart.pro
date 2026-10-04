import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { formatLeadLines } from "../lib/lead-message";
import { LEAD_RETENTION_YEARS } from "../lib/legal";

type Storage = typeof import("../lib/lead-storage");

/** Модуль привязывает файл заявок к рабочему каталогу при загрузке — поэтому сначала уходим во временный. */
function loadStorageIn(dir: string): Storage {
  process.chdir(dir);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("../lib/lead-storage") as Storage;
}

function yearsAgo(years: number, extraDays = 0): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  date.setDate(date.getDate() - extraDays);
  return date.toISOString();
}

test("заявки старше срока согласия удаляются при записи, заявку можно удалить по требованию", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "rinart-retention-"));
  mkdirSync(path.join(dir, "data"));
  writeFileSync(
    path.join(dir, "data", "leads.json"),
    JSON.stringify([
      { id: "fresh", name: "Недавняя", phone: "+79990000001", source: "Сайт", createdAt: yearsAgo(1) },
      { id: "edge", name: "Почти три года", phone: "+79990000002", source: "Сайт", createdAt: yearsAgo(LEAD_RETENTION_YEARS, -2) },
      { id: "expired", name: "Просроченная", phone: "+79990000003", source: "Сайт", createdAt: yearsAgo(LEAD_RETENTION_YEARS, 2) },
      { id: "broken", name: "Без даты", phone: "+79990000004", source: "Сайт", createdAt: "когда-то" },
    ]),
  );

  const storage = loadStorageIn(dir);

  assert.equal(storage.isWithinRetention({ createdAt: yearsAgo(LEAD_RETENTION_YEARS, 2) }, Date.now()), false);
  assert.equal(storage.isWithinRetention({ createdAt: yearsAgo(LEAD_RETENTION_YEARS, -2) }, Date.now()), true);

  await storage.saveLead({ name: "Новая", phone: "+79990000005", source: "Контакты", consent: { edition: "2026-10-04" } });

  const names = (await storage.readLeads()).map((lead) => lead.name);
  assert.deepEqual(names, ["Новая", "Недавняя", "Почти три года", "Без даты"], "просроченная заявка ушла, нечитаемая дата — нет");

  const saved = JSON.parse(readFileSync(path.join(dir, "data", "leads.json"), "utf8")) as Array<{ name: string; consent?: { edition: string } }>;
  assert.deepEqual(saved[0].consent, { edition: "2026-10-04" }, "редакция согласия сохраняется вместе с заявкой");

  assert.equal(await storage.deleteLead("fresh"), true);
  assert.equal(await storage.deleteLead("fresh"), false, "повторное удаление — заявки уже нет");
  assert.equal(await storage.deleteLead("нет такой"), false);
  assert.deepEqual(
    (await storage.readLeads()).map((lead) => lead.name),
    ["Новая", "Почти три года", "Без даты"],
  );

  // Журнал удалений: что и почему уничтожено — без самих данных.
  const journal = await storage.readLeadDeletions();
  assert.deepEqual(
    journal.map((entry) => [entry.lead, entry.reason]),
    [
      ["fresh", "manual"],
      ["expired", "retention"],
    ],
  );
  const journalText = readFileSync(path.join(dir, "data", "lead-deletions.json"), "utf8");
  assert.doesNotMatch(journalText, /Недавняя|Просроченная|\+7999/, "имён и телефонов в журнале нет");
});

test("в уведомлении о заявке видно, что согласие дано и в какой редакции", () => {
  const withConsent = formatLeadLines({
    name: "Тест",
    phone: "+79990000000",
    source: "Контакты",
    createdAt: "2026-10-04T09:00:00.000Z",
    consent: { edition: "2026-10-04" },
  }).join("\n");
  assert.match(withConsent, /Согласие на обработку данных: дано, редакция от 4 октября 2026 г\./);

  // Заявки, пришедшие до появления поля, уходят без этой строки — выдумывать редакцию нельзя.
  const legacy = formatLeadLines({ name: "Тест", phone: "+79990000000", source: "Контакты" }).join("\n");
  assert.doesNotMatch(legacy, /Согласие на обработку данных/);
});
