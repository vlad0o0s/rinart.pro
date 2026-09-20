import Link from "next/link";
import { MAIN_NAV_LINKS, type NavLink } from "@/lib/nav-links";
import styles from "./primary-nav.module.css";

export function PrimaryNav({ links = MAIN_NAV_LINKS }: { links?: NavLink[] }) {
  return (
    <nav className={styles.primaryNav} aria-label="Навигация по основным разделам">
      <ul className={styles.list}>
        {links.map((link) => {
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

