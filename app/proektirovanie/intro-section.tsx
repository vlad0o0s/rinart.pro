'use client';

import Image from "next/image";
import { useReveal } from "@/lib/use-reveal";
import styles from "./intro-section.module.css";

export function IntroSection() {
  const sectionRef = useReveal<HTMLElement>({ threshold: 0.15 });

  return (
    <section ref={sectionRef} className={styles.section} data-visible="false">
      <div className={styles.left} />
      <div className={styles.right}>
        <h2 className={styles.title}>
          Проекты разрабатываются с учетом индивидуальных предпочтений заказчика,
          особенностей участка и современной стилистической направленности.
        </h2>
        <div className={styles.bodyGrid}>
          <p className={styles.body}>
            Работаем с деревом и каменными материалами. Авторский взгляд на
            архитектуру позволит создать оригинальный проект, способный наиболее
            точно отразить идею вашего дома, создать пространство, выражающее
            стиль и образ жизни хозяев.
          </p>
          <p className={styles.body}>
            Комплексный подход при проектировании учтет все нюансы и трудности, с
            которыми Вы можете столкнуться при строительстве. Итог работы —
            подготовленная проектная документация и авторский надзор над
            реализацией проекта.
          </p>
        </div>
        <div className={styles.media}>
          <Image
            src="/img/proektirovanie-banner-desktop.webp"
            alt="Архитектурный проект"
            fill
            sizes="(max-width: 768px) 100vw, 1100px"
            className={styles.image}
            priority
          />
        </div>
      </div>
    </section>
  );
}

