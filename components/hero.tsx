"use client";

import { SafeImage as Image } from "@/components/safe-image";
import { LeadForm } from "@/components/lead-form";
import { useEffect, useMemo } from "react";
import type { MobileHeroVariant } from "@/lib/global-blocks";
import styles from "./hero.module.css";

const HERO_IMAGE = "/img/01-ilichevka.jpg";

export function Hero({ imageUrl, mobileVariant = "caption" }: { imageUrl?: string; mobileVariant?: MobileHeroVariant }) {
  const heroImage = useMemo(() => {
    const value = imageUrl?.trim();
    return value && value.length ? value : HERO_IMAGE;
  }, [imageUrl]);

  useEffect(() => {
    const updateLeadButtonTop = () => {
      const header = document.querySelector<HTMLElement>("header");
      // Не getBoundingClientRect(): шапка появляется анимацией headerReveal из
      // translateY(-16px), и прямоугольник в момент замера был на 16px выше
      // реального места. ResizeObserver на трансформации не срабатывает, поэтому
      // заниженное значение так и оставалось, а полоса кнопки залезала на логотип.
      // Шапка — position: fixed; top: 0, значит её низ равен собственной высоте.
      const top = header?.offsetHeight ?? 0;
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
    <section className={styles.hero} aria-label="Визуализация проекта Ильичевка" data-mobile-hero={mobileVariant}>
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
        {/* Единственный H1 главной: до этого фраза была декоративным span с aria-hidden,
            из-за чего страница уходила в индекс вообще без заголовка. */}
        <h1 className={styles.heroTagline}>Проектирование загородных домов</h1>
        {/* Гео и короткое объяснение видны только на экранах уже 1024px: на широких
            первый экран остаётся прежним, а на телефоне посетитель наконец видит,
            что за услуга и где она оказывается. */}
        <p className={styles.heroGeo}>Москва и Московская область</p>
        <p className={styles.heroLead}>Индивидуальные проекты частных домов — от эскиза до рабочей документации.</p>
        <LeadForm source="Главная страница" placement="hero" openButtonClassName={styles.heroCta} />
      </div>
    </section>
  );
}
