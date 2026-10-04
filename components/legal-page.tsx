import type { ReactNode } from "react";
import Link from "next/link";
import { CookieSettingsButton } from "@/components/cookie-settings-button";
import { Footer } from "@/components/footer";
import { RouteReadyAnnouncer } from "@/components/route-ready-announcer";
import { SiteHeader } from "@/components/site-header";
import { LEGAL_PATHS, formatEdition } from "@/lib/legal";
import { getMainNavLinks } from "@/lib/navigation";
import { getSocialLinks } from "@/lib/site-settings";
import styles from "./legal-page.module.css";

/**
 * Общая оболочка документов сайта: политика, согласие, файлы cookie.
 *
 * Тексты лежат в коде страниц, а не в базе: редакция документа — юридически значимая
 * вещь, она меняется вместе с датой редакции и проходит через выкладку, а не правится
 * на лету из админки.
 */

const DOCUMENTS = [
  { href: LEGAL_PATHS.privacy, label: "Политика конфиденциальности" },
  { href: LEGAL_PATHS.consent, label: "Согласие на обработку персональных данных" },
  { href: LEGAL_PATHS.cookies, label: "Файлы куки (cookie)" },
];

type LegalPageProps = {
  /** Адрес этой страницы — чтобы не ссылаться на себя в списке документов. */
  path: string;
  /** Короткое название для строки навигации в шапке. */
  breadcrumb: string;
  title: string;
  /** Дата редакции в виде ГГГГ-ММ-ДД. */
  edition: string;
  children: ReactNode;
};

export async function LegalPage({ path, breadcrumb, title, edition, children }: LegalPageProps) {
  const [socialLinks, navLinks] = await Promise.all([getSocialLinks(), getMainNavLinks()]);

  return (
    <>
      <SiteHeader showDesktopNav socialLinks={socialLinks} navLinks={navLinks} breadcrumbLabel={breadcrumb} />
      <main className={styles.page}>
        <article className={styles.document}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.edition}>
            Редакция от <time dateTime={edition}>{formatEdition(edition)}</time>
          </p>

          <div className={styles.body}>{children}</div>

          <nav className={styles.related} aria-label="Другие документы">
            <p className={styles.relatedTitle}>Другие документы</p>
            <ul className={styles.relatedList}>
              {DOCUMENTS.filter((document) => document.href !== path).map((document) => (
                <li key={document.href}>
                  <Link href={document.href}>{document.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </article>
      </main>
      <Footer />
      <RouteReadyAnnouncer />
    </>
  );
}

/** Вводный абзац простыми словами — суть документа до юридических формулировок. */
export function LegalSummary({ children }: { children: ReactNode }) {
  return <div className={styles.summary}>{children}</div>;
}

export function LegalSection({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section className={styles.section} id={id}>
      <h2 className={styles.heading}>{title}</h2>
      {children}
    </section>
  );
}

/** Кнопка в тексте документа: открывает баннер с выбором о файлах куки. */
export function LegalCookieSettings({ children }: { children: ReactNode }) {
  return <CookieSettingsButton className={styles.action}>{children}</CookieSettingsButton>;
}

/** Нумерованный пункт: номер стоит в поле слева, текст — ровной колонкой. */
export function Clause({ n, children }: { n: string; children: ReactNode }) {
  return (
    <div className={styles.clause}>
      <span className={styles.clauseNumber}>{n}</span>
      <div className={styles.clauseText}>{children}</div>
    </div>
  );
}

/** Таблица с прокруткой по горизонтали на узких экранах. */
export function LegalTable({ caption, head, rows }: { caption: string; head: string[]; rows: ReactNode[][] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className={styles.tableCaption}>{caption}</caption>
        <thead>
          <tr>
            {head.map((cell) => (
              <th key={cell} scope="col">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} data-label={head[cellIndex]}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
