"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SocialLink, SocialPlatform } from "@/types/site";
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

const DEFAULT_SOCIAL_LINKS: SocialLink[] = [
  { id: "instagram", platform: "instagram", label: "Instagram", url: "https://www.instagram.com/rinart.buro/" },
  { id: "telegram", platform: "telegram", label: "Telegram", url: "https://t.me/rinart_buro" },
  { id: "vk", platform: "vk", label: "VK", url: "https://vk.com/rinart_buro" },
  { id: "pinterest", platform: "pinterest", label: "Pinterest", url: "https://www.pinterest.com/rinartburo" },
];

const SOCIAL_ICON_CLASS_MAP: Partial<Record<SocialPlatform, keyof typeof styles>> = {
  instagram: "iconInstagram",
  telegram: "iconTelegram",
  vk: "iconVk",
  pinterest: "iconPinterest",
};

function getSocialIconClass(platform: SocialPlatform) {
  const key = SOCIAL_ICON_CLASS_MAP[platform];
  return key ? styles[key] : undefined;
}

export type SiteHeaderProps = {
  showDesktopNav?: boolean;
  showDesktopBrand?: boolean;
  subLinks?: { href: string; label: string }[];
  breadcrumbLabel?: string;
  socialLinks?: SocialLink[];
};

type Breadcrumb = { href: string; label: string; className?: string };

export function SiteHeader({
  showDesktopNav = false,
  showDesktopBrand = false,
  subLinks,
  breadcrumbLabel,
  socialLinks,
}: SiteHeaderProps) {
  // Debug log removed
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const burgerButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLElement | null>(null);
  const sanitizedBreadcrumbLabel = breadcrumbLabel?.trim();
  const resolvedSocialLinks = useMemo(() => (socialLinks?.length ? socialLinks : DEFAULT_SOCIAL_LINKS), [socialLinks]);

  const breadcrumbs = useMemo<Breadcrumb[]>(() => {
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
    const currentLabel = sanitizedBreadcrumbLabel ?? labels[pathname] ?? fallbackLabel;

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
  }, [pathname, sanitizedBreadcrumbLabel]);

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
      <DesktopHeaderSection showDesktopBrand={showDesktopBrand} showDesktopNav={showDesktopNav} />

      <MobileHeaderSection
        menuOpen={menuOpen}
        burgerButtonRef={burgerButtonRef}
        toggleMenu={toggleMenu}
        showBreadcrumbs={showBreadcrumbs}
        breadcrumbs={breadcrumbs}
        renderBreadcrumbLabel={renderBreadcrumbLabel}
        showBrand={!showDesktopBrand}
      />

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
      <MobileMenu menuOpen={menuOpen} menuRef={menuRef} closeMenu={closeMenu} socials={resolvedSocialLinks} />
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

function DesktopHeaderSection({
  showDesktopBrand,
  showDesktopNav,
}: {
  showDesktopBrand: boolean;
  showDesktopNav: boolean;
}) {
  if (!showDesktopBrand && !showDesktopNav) {
    return null;
  }

  return (
    <div className={`${styles.wrapper} hidden md:flex`}>
      {showDesktopBrand ? <DesktopBrand /> : null}
      {showDesktopNav ? <DesktopNavigation /> : null}
    </div>
  );
}

function DesktopBrand() {
  return (
    <Link
      href="/"
      className={`inline-block w-auto max-w-none text-[12px] font-black uppercase leading-[12px] md:text-[clamp(18px,1.5vw,32px)] md:leading-[17px] ${styles.root} ${styles.desktopBrand}`}
      aria-label="Перейти на главную"
    >
      <span className={`${styles.architect} ${styles.architectBrand}`}>Архитектор</span>
      <span className={styles.accent}>РИНАТ ГИЛЬМУТДИНОВ</span>
    </Link>
  );
}

function DesktopNavigation() {
  return (
    <nav className={styles.desktopNav} aria-label="Основное меню">
      <ul className={styles.desktopNavList}>
        {NAV_LINKS.map((link) => (
          <li key={link.href} className={styles.desktopNavItem}>
            <Link href={link.href}>{link.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function MobileHeaderSection({
  menuOpen,
  toggleMenu,
  burgerButtonRef,
  showBreadcrumbs,
  breadcrumbs,
  renderBreadcrumbLabel,
  showBrand,
}: {
  menuOpen: boolean;
  toggleMenu: () => void;
  burgerButtonRef: MutableRefObject<HTMLButtonElement | null>;
  showBreadcrumbs: boolean;
  breadcrumbs: Breadcrumb[];
  renderBreadcrumbLabel: (label: string) => string | ReactNode;
  showBrand: boolean;
}) {
  return (
    <div className={`${styles.mobileControls} md:hidden`}>
      <div className={styles.mobileTopLine}>
        {showBrand ? (
          <Link
            href="/"
            className={`${styles.root} ${styles.mobileBrandCompact}`}
            aria-label="Перейти на главную"
          >
            <span className={styles.architect}>Архитектор</span>
            <span>РИНАТ ГИЛЬМУТДИНОВ</span>
          </Link>
        ) : (
          <span aria-hidden className={`${styles.root} ${styles.mobileBrandPlaceholder}`} />
        )}
        <div className={styles.mobileControlsButtonWrapper}>
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
      </div>
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
    </div>
  );
}

function MobileMenu({
  menuOpen,
  menuRef,
  closeMenu,
  socials,
}: {
  menuOpen: boolean;
  menuRef: MutableRefObject<HTMLElement | null>;
  closeMenu: () => void;
  socials: SocialLink[];
}) {
  return (
    <nav
      className={`${styles.menu} ${menuOpen ? styles.menuOpen : ""}`}
      aria-hidden={!menuOpen}
      ref={menuRef}
    >
      <div className={styles.menuPanel}>
        <div className={styles.menuContent}>
          <ul className={styles.menuList}>
            {NAV_LINKS.map((link, index) => (
              <li
                key={`${link.href}-mobile`}
                className={`${styles.menuItem} ${index === 0 ? styles.menuItemHideMobile : ""}`}
              >
                <Link href={link.href} onClick={closeMenu}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className={styles.socials}>
            {socials.map((social) => {
              const iconClass = getSocialIconClass(social.platform);
              if (!iconClass) {
                return null;
              }
              return (
                <a
                  key={`mobile-social-${social.id}`}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                >
                  <span className={`${styles.icon} ${iconClass}`} />
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}

