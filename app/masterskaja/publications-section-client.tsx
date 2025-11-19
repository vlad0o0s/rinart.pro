"use client";

import { useReveal } from "@/lib/use-reveal";
import styles from "./publications-section.module.css";

export function PublicationsSectionClient({ publications }: { publications: string[] }) {
  const sectionRef = useReveal<HTMLElement>({ threshold: 0.2 });

  return (
    <section ref={sectionRef} className={styles.section} id="publish" data-visible="false">
      <div className={styles.wrapper}>
        <div className={styles.marker}>
          <p className={styles.markerLabel}>
            <em>(III)</em> ПУБЛИКАЦИИ И НАГРАДЫ
          </p>
        </div>
        <ul className={styles.list}>
          {publications.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

