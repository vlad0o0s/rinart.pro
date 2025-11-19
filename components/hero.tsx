"use client";

import { SafeImage as Image } from "@/components/safe-image";
import { useMemo } from "react";
import styles from "./hero.module.css";

const HERO_IMAGE = "/img/01-ilichevka.jpg";

export function Hero({ imageUrl }: { imageUrl?: string }) {
  const heroImage = useMemo(() => {
    const value = imageUrl?.trim();
    return value && value.length ? value : HERO_IMAGE;
  }, [imageUrl]);

  // const isRemoteHero = /^https?:\/\//i.test(heroImage);

  return (
    <section className={styles.hero} aria-label="Визуализация проекта Ильичевка">
      <div className={styles.imageWrapper}>
        <Image
          src={heroImage}
          alt="Современный частный дом в окружении хвойного леса"
          fill
          priority
          fetchPriority="high"
          loading="eager"
          sizes="100vw"
          className={styles.image}
          // грузим оригинальный файл без прокси Next/Image, чтобы не было кеша и 400 в dev
          unoptimized
        />
      </div>
      <div className={styles.overlay}></div>
      <div className={styles.content}>{/* Content for hero section will be added in subsequent steps */}</div>
    </section>
  );
}

