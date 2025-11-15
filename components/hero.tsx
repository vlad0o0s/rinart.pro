"use client";

import Image from "next/image";
import { useMemo } from "react";
import styles from "./hero.module.css";

const HERO_IMAGE = "/img/01-ilichevka.jpg";
const HERO_TEXTURE = "/img/noisy-background.webp";

export function Hero({ imageUrl }: { imageUrl?: string }) {
  const heroImage = useMemo(() => {
    const value = imageUrl?.trim();
    return value && value.length ? value : HERO_IMAGE;
  }, [imageUrl]);

  const isRemoteHero = /^https?:\/\//i.test(heroImage);

  return (
    <section className={styles.hero} aria-label="Визуализация проекта Ильичевка">
      <Image
        src={heroImage}
        alt="Современный частный дом в окружении хвойного леса"
        fill
        priority
        fetchPriority="high"
        loading="eager"
        sizes="100vw"
        className={styles.image}
        unoptimized={isRemoteHero}
      />
      <div className={styles.overlay}>
        <Image
          src={HERO_TEXTURE}
          alt=""
          fill
          priority
          fetchPriority="high"
          loading="eager"
          sizes="100vw"
          className={styles.overlayTexture}
        />
      </div>
      <div className={styles.content}>{/* Content for hero section will be added in subsequent steps */}</div>
    </section>
  );
}

