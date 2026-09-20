import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RESERVED_TOP_LEVEL_SLUGS,
  articleModifiedAt,
  formatArticleDate,
  isValidArticleSlug,
  parseDateInput,
  sanitizeArticleHtml,
  slugifyTitle,
  validateArticleInput,
} from "../lib/articles";
import { articleSchema } from "../lib/seo/schema";

const LONG_BODY = `<h2>Из чего складывается цена</h2><p>${"Стоимость проекта зависит от площади, состава разделов и сложности участка. ".repeat(8)}</p>`;

test("адрес статьи строится из заголовка той же транслитерацией, что у проектов", () => {
  assert.equal(slugifyTitle("Из чего складывается стоимость проекта дома"), "iz-chego-skladyvaetsya-stoimost-proekta-doma");
  assert.equal(slugifyTitle("Дом на участке с перепадом высот!"), "dom-na-uchastke-s-perepadom-vysot");
  assert.equal(isValidArticleSlug("dom-na-holme"), true);
  assert.equal(isValidArticleSlug("Dom na holme"), false);
  assert.equal(isValidArticleSlug("new"), false);
  assert.ok(RESERVED_TOP_LEVEL_SLUGS.has("stati"), "проект не может занять адрес раздела статей");
});

test("черновик сохраняется почти пустым, публикация требует текста и автора", () => {
  const draft = validateArticleInput({ title: "Черновик" });
  assert.equal(draft.ok, true);
  if (draft.ok) {
    assert.equal(draft.value.status, "draft");
    assert.equal(draft.value.slug, "chernovik");
    assert.equal(draft.value.publishedAt, null);
  }

  const noAuthor = validateArticleInput({ title: "Статья", status: "published", bodyHtml: LONG_BODY });
  assert.equal(noAuthor.ok, false);
  if (!noAuthor.ok) assert.ok(noAuthor.errors.some((error) => error.includes("автор")));

  const short = validateArticleInput({ title: "Статья", status: "published", bodyHtml: "<p>Коротко</p>", authorName: "Ринат Гильмутдинов" });
  assert.equal(short.ok, false);

  const now = new Date("2026-10-01T10:00:00.000Z");
  const ok = validateArticleInput({ title: "Статья", status: "published", bodyHtml: LONG_BODY, authorName: "Ринат Гильмутдинов" }, now);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.value.publishedAt, now.toISOString(), "дата публикации ставится при публикации");
});

test("чужие адреса и неизвестные значения не проходят в статью", () => {
  const result = validateArticleInput({
    title: "Статья",
    servicePath: "/evil",
    relatedProjects: ["idalgo", "hill", "idalgo", "../x", 5],
    coverImageUrl: "https://evil.example/pic.jpg",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.servicePath, null);
    assert.deepEqual(result.value.relatedProjects, ["idalgo", "hill"]);
    assert.equal(result.value.coverImageUrl, null);
  }

  const withService = validateArticleInput({ title: "Статья", servicePath: "/proektirovanie", coverImageUrl: "/uploads/inline-1.webp" });
  assert.equal(withService.ok && withService.value.servicePath, "/proektirovanie");
  assert.equal(withService.ok && withService.value.coverImageUrl, "/uploads/inline-1.webp");
});

test("очистка HTML: скрипты, обработчики и javascript-ссылки убираются, оформление остаётся", () => {
  const dirty =
    '<h2>Заголовок</h2><p onclick="alert(1)">Текст <b>жирный</b> <a href="javascript:alert(1)">ссылка</a> <a href="/proektirovanie">услуга</a></p>' +
    "<script>alert(1)</script><style>p{}</style><iframe src=\"https://x\"></iframe><img src=\"/uploads/a.webp\" alt=\"План\" onerror=\"x()\">";
  const clean = sanitizeArticleHtml(dirty);
  assert.ok(!/script|style|iframe|onclick|onerror|javascript:/i.test(clean), clean);
  assert.ok(clean.includes("<h2>Заголовок</h2>"));
  assert.ok(clean.includes("<b>жирный</b>"));
  assert.ok(clean.includes('<a href="/proektirovanie">услуга</a>'));
  assert.ok(clean.includes('<img src="/uploads/a.webp" alt="План">'));
  assert.equal(sanitizeArticleHtml('<a href=javascript:alert(1)>x</a>'), "<a>x</a>");
});

test("даты: поле формы — день по Москве, изменённой считается только более поздняя дата", () => {
  assert.equal(parseDateInput("2026-10-05"), "2026-10-05T06:00:00.000Z");
  assert.equal(parseDateInput(""), null);
  assert.equal(parseDateInput("вчера"), null);

  const published = "2026-10-01T10:00:00.000Z";
  assert.equal(articleModifiedAt({ publishedAt: published, contentUpdatedAt: null }), published);
  assert.equal(articleModifiedAt({ publishedAt: published, contentUpdatedAt: "2026-11-02T10:00:00.000Z" }), "2026-11-02T10:00:00.000Z");
  assert.equal(articleModifiedAt({ publishedAt: published, contentUpdatedAt: "2026-09-01T10:00:00.000Z" }), published);
  assert.equal(formatArticleDate("2026-10-01T22:30:00.000Z"), "2 октября 2026 г.");
});

test("разметка статьи: Article с автором и датами, крошки через раздел", () => {
  const [article, crumbs] = articleSchema({
    slug: "stoimost-proekta",
    title: "Из чего складывается стоимость проекта",
    excerpt: "Коротко о цене",
    seoDescription: "",
    coverImageUrl: "/uploads/inline-1.webp",
    authorName: "Ринат Гильмутдинов",
    authorRole: "архитектор",
    publishedAt: "2026-10-01T10:00:00.000Z",
    contentUpdatedAt: "2026-11-02T10:00:00.000Z",
  }) as Array<Record<string, unknown>>;

  assert.equal(article["@type"], "Article");
  assert.equal(article.url, "https://rinart.pro/stati/stoimost-proekta");
  assert.deepEqual(article.image, ["https://rinart.pro/uploads/inline-1.webp"]);
  assert.equal(article.dateModified, "2026-11-02T10:00:00.000Z");
  assert.deepEqual(article.author, { "@type": "Person", name: "Ринат Гильмутдинов", jobTitle: "архитектор" });
  assert.equal(article.description, "Коротко о цене");
  assert.deepEqual(
    (crumbs.itemListElement as Array<{ item: string }>).map((item) => item.item),
    ["https://rinart.pro", "https://rinart.pro/stati", "https://rinart.pro/stati/stoimost-proekta"],
  );
});
