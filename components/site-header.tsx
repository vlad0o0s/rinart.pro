"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./site-header.module.css";

const NAV_LINKS = [
  { href: "/", label: "RINART" },
  { href: "/#portfolio", label: "Портфолио" },
  { href: "/proektirovanie", label: "Проектирование" },
  { href: "/masterskaja", label: "Мастерская" },
  { href: "/kontakty", label: "Контакты" },
];

const PROEKTIR_SUBLINKS = [
  { href: "#vidy", label: "Виды работ" },
  { href: "#etap", label: "Этапы проектирования" },
  { href: "#price", label: "Стоимость проектирования" },
];

export type SiteHeaderProps = {
  showDesktopNav?: boolean;
  showBrand?: boolean;
  subLinks?: { href: string; label: string }[];
};

export function SiteHeader({
  showDesktopNav = false,
  showBrand = true,
  subLinks,
}: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

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

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={`w-full bg-white ${styles.header}`}>
      <div className={`${styles.wrapper} md:flex`}>
        <p
          className={`inline-block w-auto max-w-none text-[12px] font-black uppercase leading-[12px] md:text-[clamp(18px,1.5vw,32px)] md:leading-[17px] ${styles.root} ${styles.desktopBrand}`}
        >
          Архитектор <span className={styles.accent}>РИНАТ ГИЛЬМУТДИНОВ</span>
        </p>

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
      <button
        type="button"
        className={styles.burger}
        aria-label="Открыть меню"
        aria-expanded={menuOpen}
        data-active={menuOpen ? "true" : "false"}
        onClick={toggleMenu}
      >
        <span className={styles.burgerElement} />
        <span className={styles.burgerElement} />
        <span className={styles.burgerElement} />
        <span className={styles.burgerElement} />
      </button>
      <nav
        className={`${styles.menu} ${menuOpen ? styles.menuOpen : ""}`}
        aria-hidden={!menuOpen}
      >
        <p
          className={`inline-block w-auto max-w-none text-[12px] font-black uppercase leading-[12px] md:hidden ${styles.root} ${styles.mobileBrand}`}
        >
          Архитектор <span className={styles.accent}>РИНАТ ГИЛЬМУТДИНОВ</span>
        </p>
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

export { PROEKTIR_SUBLINKS };

