"use client";

import styles from "./hero-section.module.css";

export function HeroSection() {
  return (
    <section className={styles.hero}>
      <h1 className={styles.title}>
        Основное направление деятельности мастерской — проектирование частных
        домов и сопутствующих построек.
      </h1>
    </section>
  );
}

