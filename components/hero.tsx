"use client";

import { SafeImage as Image } from "@/components/safe-image";
import { LeadForm } from "@/components/lead-form";
import { useEffect, useMemo } from "react";
import styles from "./hero.module.css";

const HERO_IMAGE = "/img/01-ilichevka.jpg";

export function Hero({ imageUrl }: { imageUrl?: string }) {
  const heroImage = useMemo(() => {
    const value = imageUrl?.trim();
    return value && value.length ? value : HERO_IMAGE;
  }, [imageUrl]);

  useEffect(() => {
    const updateLeadButtonTop = () => {
      const header = document.querySelector("header");
      const top = header?.getBoundingClientRect().bottom ?? 0;
      document.documentElement.style.setProperty("--lead-button-top", `${Math.round(top)}px`);
    };

    updateLeadButtonTop();
    window.addEventListener("resize", updateLeadButtonTop);
    window.addEventListener("orientationchange", updateLeadButtonTop);

    const header = document.querySelector("header");
    const observer = header ? new ResizeObserver(updateLeadButtonTop) : null;

    if (header && observer) {
      observer.observe(header);
    }

    return () => {
      window.removeEventListener("resize", updateLeadButtonTop);
      window.removeEventListener("orientationchange", updateLeadButtonTop);
      observer?.disconnect();
    };
  }, []);

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
      <div className={styles.content} aria-label="Заявка">
        <LeadForm source="Главная страница" placement="hero" />
      </div>
    </section>
  );
}
