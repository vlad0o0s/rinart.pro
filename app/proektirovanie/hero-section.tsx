"use client";

import { useReveal } from "@/lib/use-reveal";
import styles from "./hero-section.module.css";

export function HeroSection() {
  const sectionRef = useReveal<HTMLElement>({ threshold: 0.1 });

  return (
    <section ref={sectionRef} className={styles.hero} data-visible="false">
      {/* Заголовок страницы называет услугу и город: раньше в H1 стояло предложение о
          мастерской, по которому страницу нельзя было узнать ни человеку, ни поиску. */}
      <h1 className={styles.title}>Проектирование частных и загородных домов в Москве и области</h1>
      <p className={styles.lead}>
        Основное направление деятельности мастерской — проектирование частных загородных домов и интерьеров.
      </p>
    </section>
  );
}

