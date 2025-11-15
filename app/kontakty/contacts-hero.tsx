'use client';

import type { CSSProperties } from "react";
import Image from "next/image";
import { useReveal } from "@/lib/use-reveal";
import type { ContactSettings, SocialLink } from "@/types/site";
import styles from "./page.module.css";

type ContactsHeroProps = {
  contact: ContactSettings;
  socials: SocialLink[];
};

export default function ContactsHero({ contact, socials }: ContactsHeroProps) {
  const heroRef = useReveal<HTMLElement>({ threshold: 0.15, rootMargin: "0px 0px -20% 0px" });
  const primaryItems = [
    { label: contact.phoneLabel, href: contact.phoneHref },
    { label: contact.emailLabel, href: contact.emailHref },
  ].filter((item) => Boolean(item.label && item.href));

  const socialItems = socials.filter((item) => item.url && item.label);

  return (
    <section ref={heroRef} className={styles.hero} data-visible="false">
      <div className={styles.heroContent}>
        {contact.heroTitle ? (
          <p className={styles.contactTitle} style={{ "--reveal-index": 0 } as CSSProperties}>
            {contact.heroTitle}
          </p>
        ) : null}

        <div className={styles.contactPrimary} style={{ "--reveal-index": 1 } as CSSProperties}>
          {primaryItems.map((item) => (
            <a key={item.label} href={item.href} className={styles.contactLine}>
              {item.label}
            </a>
          ))}
        </div>

        {socialItems.length ? (
          <div className={styles.contactSocialsList} style={{ "--reveal-index": 2 } as CSSProperties}>
            {socialItems.map((item) => (
              <a key={item.id} href={item.url} className={styles.contactSocialLine} target="_blank" rel="noopener noreferrer">
                {item.label}
              </a>
            ))}
          </div>
        ) : null}

        {contact.locationLabel ? (
          <span className={`${styles.contactLine} ${styles.contactPlain}`} style={{ "--reveal-index": 3 } as CSSProperties}>
            {contact.locationLabel}
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

