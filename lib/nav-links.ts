/**
 * Основное меню — один список для шапки, мобильного меню и навигации главной.
 * Без обращений к базе: модуль импортирует и клиентская шапка. Пункты, которые зависят
 * от наполнения сайта, добавляет lib/navigation.ts на сервере.
 */
export type NavLink = { href: string; label: string };

export const MAIN_NAV_LINKS: NavLink[] = [
  { href: "/", label: "RINART" },
  { href: "/#portfolio", label: "Портфолио" },
  { href: "/proektirovanie", label: "Проектирование" },
  { href: "/masterskaja", label: "Мастерская" },
  { href: "/kontakty", label: "Контакты" },
];
