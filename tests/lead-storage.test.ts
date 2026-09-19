import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

type Storage = typeof import("../lib/lead-storage");

/** Модуль привязывает файл заявок к рабочему каталогу при загрузке — поэтому сначала уходим во временный. */
function loadStorageIn(dir: string): Storage {
  process.chdir(dir);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("../lib/lead-storage") as Storage;
}

test("заявки не теряются при одновременной записи, отметка «тест» сохраняется", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "rinart-leads-"));
  mkdirSync(path.join(dir, "data"));
  // Заявка, сохранённая до появления идентификаторов.
  writeFileSync(
    path.join(dir, "data", "leads.json"),
    JSON.stringify([{ name: "Старая", phone: "+79990000001", source: "Сайт", createdAt: "2026-08-01T10:00:00.000Z" }]),
  );

  const storage = loadStorageIn(dir);

  await Promise.all([
    storage.saveLead({ name: "А", phone: "+79990000002", source: "Главная страница" }),
    storage.saveLead({ name: "Б", phone: "+79990000003", source: "Контакты" }),
  ]);

  const leads = await storage.readLeads();
  assert.equal(leads.length, 3);
  assert.equal(new Set(leads.map(storage.leadKey)).size, 3);
  assert.ok(leads.filter((lead) => lead.id).length === 2, "у новых заявок есть идентификатор");

  const fresh = leads.find((lead) => lead.name === "А");
  assert.ok(fresh);
  assert.equal(await storage.setLeadTestFlag(storage.leadKey(fresh), true), true);
  // Старая заявка без идентификатора находится по времени создания.
  assert.equal(await storage.setLeadTestFlag("ts:2026-08-01T10:00:00.000Z", true), true);
  assert.equal(await storage.setLeadTestFlag("нет такой", true), false);

  const saved = JSON.parse(readFileSync(path.join(dir, "data", "leads.json"), "utf8")) as Array<{ name: string; isTest?: boolean }>;
  assert.deepEqual(
    saved.filter((lead) => lead.isTest).map((lead) => lead.name).sort(),
    ["Старая", "А"].sort(),
  );

  assert.equal(await storage.setLeadTestFlag(storage.leadKey(fresh), false), true);
  const after = await storage.readLeads();
  assert.equal(after.find((lead) => lead.name === "А")?.isTest, undefined);
});
