"use client";

import { useReveal } from "@/lib/use-reveal";
import styles from "./hero-section.module.css";

export function HeroSection() {
  const sectionRef = useReveal<HTMLElement>({ threshold: 0.1 });

  return (
    <section ref={sectionRef} className={styles.hero} data-visible="false">
      <h1 className={styles.title}>
        Основное направление деятельности мастерской — проектирование частных загородных домов и интерьеров.
      </h1>
    </section>
  );
}

