import Link from "next/link";
import styles from "./primary-nav.module.css";

const LINKS = [
  { href: "/", label: "RINART" },
  { href: "/#portfolio", label: "Портфолио" },
  { href: "/proektirovanie", label: "Проектирование" },
  { href: "/masterskaja", label: "Мастерская" },
  { href: "/kontakty", label: "Контакты" },
];

export function PrimaryNav() {
  return (
    <nav className={styles.primaryNav} aria-label="Навигация по основным разделам">
      <ul className={styles.list}>
        {LINKS.map((link) => {
          // Use regular <a> for anchor links (href contains #) to allow proper anchor navigation
          const isAnchorLink = link.href.includes("#");
          return (
            <li key={link.href} className={styles.item}>
              {isAnchorLink ? (
                <a href={link.href}>{link.label}</a>
              ) : (
                <Link href={link.href}>{link.label}</Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

