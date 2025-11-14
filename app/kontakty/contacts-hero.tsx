'use client';

import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { useReveal } from "@/lib/use-reveal";
import styles from "./page.module.css";

export type ContactItem =
  | { type: "title"; label: string }
  | { type: "link"; label: string; href: string }
  | { type: "plain"; label: string };

export default function ContactsHero({ contacts }: { contacts: ContactItem[] }) {
  const heroRef = useReveal<HTMLElement>({ threshold: 0.15, rootMargin: "0px 0px -20% 0px" });

  return (
    <section ref={heroRef} className={styles.hero} data-visible="false">
      <div className={styles.heroContent}>
        {contacts.map((item, index) => {
          const delayStyle = { "--reveal-index": index } as CSSProperties;

          if (item.type === "title") {
            return (
              <p key={item.label} className={styles.contactTitle} style={delayStyle}>
                {item.label}
              </p>
            );
          }

          if (item.type === "link" && item.href) {
            return (
              <Link key={item.label} href={item.href} className={styles.contactLine} style={delayStyle}>
                {item.label}
              </Link>
            );
          }

          return (
            <span
              key={item.label}
              className={`${styles.contactLine} ${styles.contactPlain}`}
              style={delayStyle}
            >
              {item.label}
            </span>
          );
        })}
      </div>

      <div className={styles.heroImage}>
        <Image
          src="/img/group-1005.webp"
          alt="Команда RINART"
          fill
          className={styles.image}
          sizes="(max-width: 768px) 100vw, 480px"
          priority
        />
      </div>
    </section>
  );
}

