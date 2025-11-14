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
        {LINKS.map((link) => (
          <li key={link.href} className={styles.item}>
            <a href={link.href}>{link.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

