import { hasPublishedArticles } from "./article-repository";
import { ARTICLES_LABEL, ARTICLES_PATH } from "./articles";
import { MAIN_NAV_LINKS, type NavLink } from "./nav-links";

/**
 * Меню с учётом разделов, которые появляются по мере наполнения: пункт «Статьи» —
 * только когда опубликована хотя бы одна статья, чтобы не вести посетителя в пустой раздел.
 */
export async function getMainNavLinks(): Promise<NavLink[]> {
  if (!(await hasPublishedArticles())) {
    return MAIN_NAV_LINKS;
  }
  const links = [...MAIN_NAV_LINKS];
  const before = links.findIndex((link) => link.href === "/masterskaja");
  links.splice(before >= 0 ? before : links.length, 0, { href: ARTICLES_PATH, label: ARTICLES_LABEL });
  return links;
}
