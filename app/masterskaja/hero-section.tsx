"use client";

import Image from "next/image";
import { useReveal } from "@/lib/use-reveal";
import styles from "./hero-section.module.css";

export function MasterskajaHero() {
  const sectionRef = useReveal<HTMLElement>({ threshold: 0.15 });

  return (
    <section ref={sectionRef} className={styles.section} data-visible="false">
      <div className={styles.inner}>
        <div className={styles.headingRow}>
          <h1 className={styles.title}>Архитектурная мастерская RINART</h1>
          <p className={styles.lead}>
            Специализируемся на проектировании загородных домов и интерьеров. Мы занимаемся только
            индивидуальными проектами. Делаем подробные проекты и сопровождаем строительство объекта.
          </p>
        </div>
      </div>

      <div className={styles.imageContainer}>
        <div className={styles.imageWrapper}>
          <Image
            src="/img/balcon.webp"
            alt="Интерьерная деталь мастерской RINART"
            fill
            className={styles.image}
            sizes="(max-width: 768px) 100vw, 1400px"
            priority
          />
        </div>
      </div>
    </section>
  );
}

