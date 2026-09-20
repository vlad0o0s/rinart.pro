import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRobotsTxt } from "../lib/seo/robots";
import { organizationSchema, projectPageSchema, webSiteSchema } from "../lib/seo/schema";
import { filledOrUndefined, metaDescriptionFrom, plainText, truncateAtWord } from "../lib/seo/text";
import type { ProjectDetail } from "../types/project";

test("текст для сниппета — без тегов, сущностей и лишних пробелов", () => {
  assert.equal(plainText("<p>Баня&nbsp;98&nbsp;м<sup>2</sup> &laquo;Эд&raquo;&#8212;проект</p>"), "Баня 98 м 2 «Эд»—проект");
  assert.equal(plainText("  <b>Дом</b>\n\n на &amp; холме  "), "Дом на & холме");
  assert.equal(plainText("&unknown; оставляем"), "&unknown; оставляем");
  assert.equal(plainText(null), "");
});

test("обрезка по слову: многоточие только если отрезано, без висящей пунктуации", () => {
  assert.equal(truncateAtWord("Короткий текст", 160), "Короткий текст");
  const cut = truncateAtWord("Проект загородного дома на участке с перепадом высот, панорамные окна", 40);
  assert.ok(cut.length <= 40, cut);
  assert.ok(cut.endsWith("…"), cut);
  assert.ok(!/[,\s]…$/.test(cut), cut);
  assert.equal(cut, "Проект загородного дома на участке с…");
});

test("запасное описание — первый непустой абзац", () => {
  assert.equal(metaDescriptionFrom(["", "<p>&nbsp;</p>", "<p>Второй&nbsp;абзац</p>"]), "Второй абзац");
  assert.equal(metaDescriptionFrom([]), undefined);
  assert.equal(filledOrUndefined("   "), undefined);
  assert.equal(filledOrUndefined(" Баня Эд "), "Баня Эд");
});

test("robots.txt: одна секция, запреты на месте, Clean-param, без Host", () => {
  const robots = buildRobotsTxt();
  const lines = robots.split("\n");

  assert.equal(lines.filter((line) => /^user-agent:/i.test(line)).length, 1);
  assert.ok(lines.includes("User-agent: *"));
  for (const path of ["/admin", "/api", "/lp"]) {
    assert.ok(lines.includes(`Disallow: ${path}`), path);
  }
  assert.ok(!/^host:/im.test(robots));
  assert.ok(lines.includes("Sitemap: https://rinart.pro/sitemap.xml"));

  const cleanParams = lines.filter((line) => line.startsWith("Clean-param: "));
  assert.equal(cleanParams.length, 2);
  assert.ok(cleanParams[0].includes("utm_source") && cleanParams[0].includes("yclid"));
  assert.equal(cleanParams[1], "Clean-param: t /uploads/");
  // Ограничение Яндекса на длину правила и допустимые символы в префиксе пути.
  for (const line of cleanParams) {
    assert.ok(line.length - "Clean-param: ".length <= 500, line);
  }
  // Параметр p — старые ссылки WordPress, по нему работают редиректы: его склеивать нельзя.
  assert.ok(!/(^|[ &])p([ &]|$)/.test(cleanParams.join(" ").replace("Clean-param:", "")));
});

test("разметка организации и сайта: без поиска, без портрета вместо логотипа, с адресом и регионом", () => {
  const site = webSiteSchema() as Record<string, unknown>;
  assert.equal(site.potentialAction, undefined);

  const org = organizationSchema() as Record<string, unknown>;
  assert.equal(org.logo, undefined);
  assert.equal((org.address as Record<string, string>).streetAddress, "городок имени Баумана, 2, стр. 10, офис 5");
  assert.deepEqual(
    (org.areaServed as Array<{ name: string }>).map((area) => area.name),
    ["Москва", "Московская область"],
  );
});

test("разметка кейса: CreativeWork, абсолютные адреса картинок без base64, крошки без лишнего пункта", () => {
  const project: ProjectDetail = {
    id: 1,
    slug: "banya-ed",
    title: "Баня Эд",
    heroImageUrl: "/uploads/hero.avif",
    descriptionBody: ["", "<p>Баня&nbsp;с&nbsp;комнатой отдыха</p>"],
    facts: [],
    categories: ["Иные строения"],
    gallery: [
      { id: 1, url: "/uploads/1.avif", order: 0 },
      { id: 2, url: "data:image/png;base64,AAAA", order: 1 },
      { id: 3, url: "/uploads/hero.avif", order: 2 },
    ],
    schemes: [],
  };

  const [work, crumbs] = projectPageSchema(project) as Array<Record<string, unknown>>;
  assert.equal(work["@type"], "CreativeWork");
  assert.equal(work.description, "Баня с комнатой отдыха");
  assert.deepEqual(work.image, ["https://rinart.pro/uploads/hero.avif", "https://rinart.pro/uploads/1.avif"]);

  const items = crumbs.itemListElement as Array<{ name: string; item: string }>;
  assert.deepEqual(
    items.map((item) => item.item),
    ["https://rinart.pro", "https://rinart.pro/banya-ed"],
  );
});
