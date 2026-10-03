import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ARTICLE_LEAD_MODAL_DEFAULTS,
  ARTICLE_LEAD_MODAL_LIMITS,
  DISMISS_SNOOZE_MS,
  LEAD_SENT_SNOOZE_MS,
  articleLeadSource,
  canAutoOpen,
  readingShare,
  sanitizeArticleLeadModalSettings,
  splitArticleHtml,
} from "../lib/article-lead-modal";
import { LEAD_LIMITS } from "../lib/lead-validation";

const NOW = Date.UTC(2026, 9, 3, 12, 0, 0);
const FRESH = { shownThisSession: false, dismissedAt: null, leadSentAt: null };

const paragraph = (sentences: number) => `<p>${"Проект дома начинается с участка и задачи семьи. ".repeat(sentences)}</p>`;

test("настройки окна: пустые и чужие значения заменяются умолчаниями", () => {
  assert.deepEqual(sanitizeArticleLeadModalSettings(null), ARTICLE_LEAD_MODAL_DEFAULTS);
  assert.deepEqual(sanitizeArticleLeadModalSettings({ title: "   ", autoOpen: "да", inlineCta: 0 }), ARTICLE_LEAD_MODAL_DEFAULTS);

  const custom = sanitizeArticleLeadModalSettings({
    autoOpen: false,
    inlineCta: false,
    title: "  Рассчитаем   стоимость проекта  ",
    text: "x".repeat(1000),
    submitLabel: "Получить расчёт",
    onclick: "alert(1)",
  });
  assert.equal(custom.autoOpen, false);
  assert.equal(custom.inlineCta, false);
  assert.equal(custom.title, "Рассчитаем стоимость проекта");
  assert.equal(custom.text.length, ARTICLE_LEAD_MODAL_LIMITS.text);
  assert.equal(custom.submitLabel, "Получить расчёт");
  assert.equal(custom.inlineButton, ARTICLE_LEAD_MODAL_DEFAULTS.inlineButton);
  assert.equal("onclick" in custom, false);
});

test("окно открывается само один раз за визит и не тому, кто отказался или уже оставил заявку", () => {
  assert.equal(canAutoOpen(FRESH, NOW), true);
  assert.equal(canAutoOpen({ ...FRESH, shownThisSession: true }, NOW), false);

  assert.equal(canAutoOpen({ ...FRESH, dismissedAt: NOW - 60_000 }, NOW), false);
  assert.equal(canAutoOpen({ ...FRESH, dismissedAt: NOW - DISMISS_SNOOZE_MS - 1 }, NOW), true);

  assert.equal(canAutoOpen({ ...FRESH, leadSentAt: NOW - DISMISS_SNOOZE_MS - 1 }, NOW), false);
  assert.equal(canAutoOpen({ ...FRESH, leadSentAt: NOW - LEAD_SENT_SNOOZE_MS - 1 }, NOW), true);
});

test("доля прочитанного считается по тексту статьи, а не по всей странице", () => {
  // Статья высотой 4000 начинается на 600 ниже верха экрана высотой 800: видно 200 из 4000.
  assert.equal(readingShare(600, 4000, 800), 0.05);
  // Верх статьи ушёл на 1600 выше экрана: прошло 2400 из 4000.
  assert.equal(readingShare(-1600, 4000, 800), 0.6);
  assert.equal(readingShare(-9000, 4000, 800), 1);
  assert.equal(readingShare(900, 4000, 800), 0);
  assert.equal(readingShare(0, 0, 800), 0);
});

test("метка заявки называет способ раньше заголовка и переживает обрезку", () => {
  assert.equal(articleLeadSource("Сколько стоит проект дома", "scroll"), "Статья (окно при чтении): Сколько стоит проект дома");
  assert.equal(articleLeadSource("Сколько стоит проект дома", "inline"), "Статья (блок в тексте): Сколько стоит проект дома");

  const long = articleLeadSource("Очень длинный заголовок ".repeat(20), "exit").slice(0, LEAD_LIMITS.source);
  assert.ok(long.startsWith("Статья (окно при уходе): "));
});

test("длинная статья делится по подзаголовку, ближайшему к середине", () => {
  // Подзаголовки стоят на 14, 41, 68 и 95 % текста: ближе всех к середине — «Эскиз».
  const html = [
    paragraph(10),
    "<h2>Участок</h2>",
    paragraph(20),
    "<h2>Эскиз</h2>",
    paragraph(20),
    "<h2>Рабочий проект</h2>",
    paragraph(20),
    "<h2>Итог</h2>",
    paragraph(4),
  ].join("");

  const parts = splitArticleHtml(html);
  assert.ok(parts);
  assert.equal(parts.before + parts.after, html, "текст при делении не теряется и не меняется");
  assert.ok(parts.after.startsWith("<h2>Эскиз</h2>"));
  assert.ok(parts.before.endsWith("</p>"));
});

test("короткая статья и статья без подходящего подзаголовка выводятся целиком", () => {
  assert.equal(splitArticleHtml(""), null);
  assert.equal(splitArticleHtml(`<h2>Начало</h2>${paragraph(6)}<h2>Конец</h2>${paragraph(6)}`), null);
  assert.equal(splitArticleHtml(paragraph(80)), null, "без подзаголовков делить негде");
  // Подзаголовки только в самом начале и в самом конце — блок оказался бы не посередине.
  assert.equal(splitArticleHtml(`<h2>Вступление</h2>${paragraph(70)}<h2>Итог</h2>${paragraph(2)}`), null);
});

test("текст не режется внутри списка, цитаты или таблицы", () => {
  const nested = `${paragraph(30)}<blockquote><h2>Цитата с заголовком</h2>${paragraph(4)}</blockquote>${paragraph(30)}`;
  assert.equal(splitArticleHtml(nested), null);

  const withList = `${paragraph(30)}<ul><li>пункт</li></ul><h2>После списка</h2>${paragraph(30)}`;
  const parts = splitArticleHtml(withList);
  assert.ok(parts);
  assert.ok(parts.before.endsWith("</ul>"));
  assert.ok(parts.after.startsWith("<h2>После списка</h2>"));
});
