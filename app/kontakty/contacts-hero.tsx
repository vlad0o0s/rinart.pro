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

  const [titleItem, ...restItems] = contacts;
  const primaryItems = restItems.slice(0, 2);
  const socialItems = restItems.slice(2, restItems.length - 1);
  const locationItem = restItems[restItems.length - 1];

  return (
    <section ref={heroRef} className={styles.hero} data-visible="false">
      <div className={styles.heroContent}>
        {titleItem?.type === "title" ? (
          <p className={styles.contactTitle} style={{ "--reveal-index": 0 } as CSSProperties}>
            {titleItem.label}
          </p>
        ) : null}

        <div className={styles.contactPrimary} style={{ "--reveal-index": 1 } as CSSProperties}>
          {primaryItems.map((item) =>
            item.type === "link" ? (
              <Link key={item.label} href={item.href} className={styles.contactLine}>
                {item.label}
              </Link>
            ) : null,
          )}
        </div>

        <div className={styles.contactSocialsList} style={{ "--reveal-index": 2 } as CSSProperties}>
          {socialItems.map((item) =>
            item.type === "link" ? (
              <a key={item.label} href={item.href} className={styles.contactSocialLine}>
                {item.label}
              </a>
            ) : null,
          )}
        </div>

        {locationItem?.type === "plain" ? (
          <span className={`${styles.contactLine} ${styles.contactPlain}`} style={{ "--reveal-index": 3 } as CSSProperties}>
            {locationItem.label}
          </span>
        ) : null}
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

