"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./site-header.module.css";

const NAV_LINKS = [
  { href: "/", label: "RINART" },
  { href: "/#portfolio", label: "Портфолио" },
  { href: "/proektirovanie", label: "Проектирование" },
  { href: "/masterskaja", label: "Мастерская" },
  { href: "/kontakty", label: "Контакты" },
];

const ARCHITECT_WORD = "Архитектор";

const PROEKTIR_SUBLINKS = [
  { href: "#vidy", label: "Виды работ" },
  { href: "#etap", label: "Этапы проектирования" },
  { href: "#price", label: "Стоимость проектирования" },
];

const MASTERSKAJA_SUBLINKS = [
  { href: "#founder", label: "Основатель" },
  { href: "#team", label: "Команда" },
  { href: "#publications", label: "Публикации" },
];

export type SiteHeaderProps = {
  showDesktopNav?: boolean;
  showDesktopBrand?: boolean;
  showMobileBrand?: boolean;
  subLinks?: { href: string; label: string }[];
};

export function SiteHeader({
  showDesktopNav = false,
  showDesktopBrand = true,
  showMobileBrand = true,
  subLinks,
}: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const burgerButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLElement | null>(null);

  const breadcrumbs = useMemo<{ href: string; label: string; className?: string }[]>(() => {
    if (!pathname) {
      return [];
    }

    const labels: Record<string, string> = {
      "/": "",
      "/proektirovanie": "Проектирование",
      "/masterskaja": "Мастерская",
      "/kontakty": "Контакты",
    };

    const segments = pathname.split("/").filter(Boolean);
    const fallbackSegment = segments.length
      ? decodeURIComponent(segments[segments.length - 1])
          .replace(/-/g, " ")
          .replace(/\s+/g, " ")
      : "";

    const fallbackLabel = fallbackSegment.length ? fallbackSegment : "Главная";
    const currentLabel = labels[pathname] ?? fallbackLabel;

    if (pathname !== "/" && !currentLabel) {
      return [];
    }

    const secondLabel = currentLabel
      ? `Архитектор Ринат Гильмутдинов / ${currentLabel}`
      : "Архитектор Ринат Гильмутдинов";

    return [
      { href: "/", label: "Архитектор", className: styles.architect },
      { href: pathname || "/", label: secondLabel },
    ];
  }, [pathname]);

  const showBreadcrumbs = !menuOpen && breadcrumbs.length > 0;

  const renderBreadcrumbLabel = (label: string) => {
    if (!label.startsWith(ARCHITECT_WORD)) {
      return label;
    }
    const rest = label.slice(ARCHITECT_WORD.length).trimStart();
    if (!rest) {
      return <span className={styles.architect}>{ARCHITECT_WORD}</span>;
    }
    return rest;
  };

  useEffect(() => {
    if (menuOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }

    document.body.style.overflow = "";

    return undefined;
  }, [menuOpen]);

  const toggleMenu = () => {
    setMenuOpen((prev) => !prev);
  };

  const closeMenu = () => {
    setMenuOpen(false);
    if (menuRef.current?.contains(document.activeElement)) {
      burgerButtonRef.current?.focus();
    }
  };

  return (
    <header className={`w-full bg-white ${styles.header}`}>
      {showDesktopBrand ? (
        <div className={`${styles.wrapper} md:flex`}>
          <Link
            href="/"
            className={`inline-block w-auto max-w-none text-[12px] font-black uppercase leading-[12px] md:text-[clamp(18px,1.5vw,32px)] md:leading-[17px] ${styles.root} ${styles.desktopBrand}`}
            aria-label="Перейти на главную"
          >
            <span className={`${styles.architect} ${styles.architectBrand}`}>Архитектор</span>
            <span className={styles.accent}>РИНАТ ГИЛЬМУТДИНОВ</span>
          </Link>

          {showDesktopNav ? (
            <nav className={styles.desktopNav} aria-label="Основное меню">
              <ul className={styles.desktopNavList}>
                {NAV_LINKS.map((link) => (
                  <li key={link.href} className={styles.desktopNavItem}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
      ) : null}

      <div className={`${styles.mobileControls} md:hidden`}>
        {showBreadcrumbs ? (
          <nav className={styles.mobileBreadcrumbs} aria-label="Хлебные крошки">
            <ol className={styles.mobileBreadcrumbsList}>
              {breadcrumbs.map((crumb, index) => (
                <li key={`${crumb.href}-${index}`} className={styles.mobileBreadcrumbsItem}>
                  {index < breadcrumbs.length - 1 ? (
                    <Link
                      href={crumb.href}
                      className={`${styles.mobileBreadcrumbsLink} ${crumb.className ?? ""}`}
                    >
                      {renderBreadcrumbLabel(crumb.label)}
                    </Link>
                  ) : (
                    <span className={`${styles.mobileBreadcrumbsCurrent} ${crumb.className ?? ""}`}>
                      {renderBreadcrumbLabel(crumb.label)}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : (
          <div className={styles.mobileBreadcrumbs} aria-hidden="true" />
        )}
        <button
          type="button"
          className={`${styles.burger} ${styles.mobileBurger}`}
          aria-label="Открыть меню"
          aria-expanded={menuOpen}
          data-active={menuOpen ? "true" : "false"}
          onClick={toggleMenu}
          ref={burgerButtonRef}
        >
          <span className={styles.burgerElement} />
          <span className={styles.burgerElement} />
          <span className={styles.burgerElement} />
          <span className={styles.burgerElement} />
        </button>
      </div>

      {showDesktopNav && subLinks && subLinks.length ? (
        <nav className={styles.subnav} aria-label="Подразделы">
          <ul className={styles.subnavList}>
            {subLinks.map((link) => (
              <li key={link.href} className={styles.subnavItem}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      <nav
        className={`${styles.menu} ${menuOpen ? styles.menuOpen : ""}`}
        aria-hidden={!menuOpen}
        ref={menuRef}
      >
        {showMobileBrand ? (
          <Link
            href="/"
            className={`inline-block w-auto max-w-none text-[12px] font-black uppercase leading-[12px] md:hidden ${styles.root} ${styles.mobileBrand}`}
            aria-label="Перейти на главную"
            onClick={closeMenu}
          >
            <span className={`${styles.architect} ${styles.architectBrand}`}>Архитектор</span>
            <span className={styles.accent}>РИНАТ ГИЛЬМУТДИНОВ</span>
          </Link>
        ) : null}
        <ul className={styles.menuList}>
          {NAV_LINKS.map((link) => (
            <li key={`${link.href}-mobile`} className={styles.menuItem}>
              <Link href={link.href} onClick={closeMenu}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className={styles.socials}>
          <a
            href="https://www.pinterest.com/rinartburo"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Pinterest RINART"
          >
            <span className={`${styles.icon} ${styles.iconPinterest}`} />
          </a>
          <a
            href="https://t.me/rinart_buro"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Telegram RINART"
          >
            <span className={`${styles.icon} ${styles.iconTelegram}`} />
          </a>
          <a
            href="https://vk.com/rinart_buro"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="VK RINART"
          >
            <span className={`${styles.icon} ${styles.iconVk}`} />
          </a>
        </div>
      </nav>
      {menuOpen ? (
        <button
          type="button"
          className={styles.menuBackdrop}
          aria-label="Закрыть меню"
          onClick={closeMenu}
        />
      ) : null}
    </header>
  );
}

export { PROEKTIR_SUBLINKS, MASTERSKAJA_SUBLINKS };

