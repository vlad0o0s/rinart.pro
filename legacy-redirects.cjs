/**
 * Постоянные редиректы со старых адресов: сайт на WordPress (до 2025 года) и ранний
 * маршрут /projects/<slug>.
 *
 * Правила живут здесь, а не в next.config: на старые адреса ссылаются со слешем в конце
 * (например, страница номинантов goldtrezzini.ru), а Next сначала снимает слеш отдельным
 * 308 и только потом применяет свои redirects — получалась бы цепочка из двух переходов.
 * server.cjs спрашивает этот модуль до Next, поэтому переход всегда один.
 *
 * Адрес попадает сюда, только если у него есть настоящий действующий эквивалент.
 * Снятые проекты (Ильичёвка) и служебные адреса WordPress остаются честным 404.
 */

/** Соответствие подтверждено: Вебмастер хранит эти адреса как редиректы старого сайта. */
const EXACT = new Map([
  ["/2024/09/07/dom-idalgo", "/idalgo"],
  ["/2024/08/24/dom-ozerskoe", "/ozerskoe"],
  ["/2025/09/25/aznakaevo", "/aznakaevo"],
  // Портфолио теперь на главной — старый сайт сам вёл /portfolio туда же.
  ["/portfolio", "/"],
]);

/** Короткие ссылки WordPress вида /?p=<id записи>. */
const WP_POST_IDS = new Map([
  ["23", "/proektirovanie"],
  ["33", "/masterskaja"],
  ["35", "/kontakty"],
  ["31", "/"],
]);

// Только безопасные символы slug: обратный слеш или второй «/» в Location браузеры
// трактуют как начало чужого домена.
const PROJECT_PATH = /^\/projects\/([A-Za-z0-9_-]+)$/;

/**
 * @param {string} rawUrl путь с query, как его отдаёт req.url
 * @returns {string | null} адрес для Location или null, если редирект не нужен
 */
function resolveLegacyRedirect(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.startsWith("/")) {
    return null;
  }

  const queryStart = rawUrl.indexOf("?");
  const rawPath = queryStart === -1 ? rawUrl : rawUrl.slice(0, queryStart);
  const query = queryStart === -1 ? "" : rawUrl.slice(queryStart + 1);
  const pathname = rawPath.length > 1 ? rawPath.replace(/\/+$/, "") || "/" : rawPath;

  const withQuery = (target, search) => (search ? `${target}?${search}` : target);

  const exact = EXACT.get(pathname);
  if (exact) {
    return withQuery(exact, query);
  }

  const project = PROJECT_PATH.exec(pathname);
  if (project) {
    return withQuery(`/${project[1]}`, query);
  }

  if (pathname === "/" && query) {
    const params = new URLSearchParams(query);
    const target = WP_POST_IDS.get(params.get("p") ?? "");
    if (target) {
      // Сам параметр p в новом адресе не нужен, остальные (метки) сохраняем.
      params.delete("p");
      return withQuery(target, params.toString());
    }
  }

  return null;
}

module.exports = { resolveLegacyRedirect };
