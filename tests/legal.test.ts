import assert from "node:assert/strict";
import { test } from "node:test";
import { RESERVED_TOP_LEVEL_SLUGS } from "../lib/articles";
import { normalizeConsentEdition } from "../lib/lead-validation";
import {
  CONSENT_EDITION,
  COOKIE_POLICY_EDITION,
  LEGAL_PATHS,
  OPERATOR,
  POLICY_EDITION,
  formatEdition,
} from "../lib/legal";

test("дата редакции выводится по-русски", () => {
  assert.equal(formatEdition("2026-10-04"), "4 октября 2026 г.");
  assert.equal(formatEdition("2027-01-15"), "15 января 2027 г.");
  // Непонятное значение показываем как есть, а не выдуманной датой.
  assert.equal(formatEdition("без даты"), "без даты");
});

test("редакции документов записаны датами", () => {
  for (const edition of [POLICY_EDITION, CONSENT_EDITION, COOKIE_POLICY_EDITION]) {
    assert.match(edition, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test("реквизиты оператора похожи на настоящие", () => {
  assert.match(OPERATOR.inn, /^\d{12}$/, "ИНН предпринимателя — 12 цифр");
  assert.match(OPERATOR.ogrnip, /^\d{15}$/, "ОГРНИП — 15 цифр");
  assert.match(OPERATOR.email, /^[^@\s]+@[^@\s]+\.[^@\s]+$/);
});

test("адреса документов не может занять проект из портфолио", () => {
  for (const path of Object.values(LEGAL_PATHS)) {
    assert.ok(RESERVED_TOP_LEVEL_SLUGS.has(path.slice(1)), path);
  }
});

test("редакция согласия из формы: принимается дата, всё остальное заменяется текущей", () => {
  assert.equal(normalizeConsentEdition("2026-10-04"), "2026-10-04");
  assert.equal(normalizeConsentEdition("2025-01-01"), "2025-01-01");
  for (const junk of [undefined, null, 42, "", "вчера", "2026-10-04; drop", "<script>"]) {
    assert.equal(normalizeConsentEdition(junk), CONSENT_EDITION, String(junk));
  }
});
