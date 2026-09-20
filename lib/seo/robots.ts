/**
 * Содержимое robots.txt.
 *
 * Собирается вручную, а не через MetadataRoute.Robots: стандартный генератор Next не умеет
 * директиву Clean-param, а без неё Яндекс считает каждую комбинацию рекламных меток
 * отдельным адресом страницы.
 */

const SITE_URL = "https://rinart.pro";

/** Метки рекламы и аналитики: содержимое страницы от них не меняется. */
const TRACKING_PARAMS = [
  "yclid",
  "ysclid",
  "gclid",
  "fbclid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
];

export function buildRobotsTxt(): string {
  return [
    // Одна общая секция. Если завести отдельную «User-agent: Yandex», Яндекс перестанет
    // читать эту, и запреты /admin, /api и /lp пришлось бы дублировать. Clean-param —
    // межсекционная директива, отдельная секция ей не нужна.
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /api",
    "Disallow: /lp",
    `Clean-param: ${TRACKING_PARAMS.join("&")}`,
    // Параметр t дописывал к картинкам компонент SafeImage — метка времени для обхода кеша
    // (убрана). Файлы из /uploads отдаёт nginx как есть, версию параметр не выбирает.
    "Clean-param: t /uploads/",
    "",
    // Директива Host не нужна: Яндекс её не поддерживает, главное зеркало задают 301 с www и http.
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ].join("\n");
}
