"use client";

import { SafeImage as Image } from "@/components/safe-image";
import Link from "next/link";
import { useRef } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import styles from "./page.module.css";

type RelatedProject = {
  slug: string;
  title: string;
  heroImageUrl?: string;
};

export function RelatedProjectsSlider({ projects }: { projects: RelatedProject[] }) {
  const prevRef = useRef<HTMLButtonElement | null>(null);
  const nextRef = useRef<HTMLButtonElement | null>(null);
  // Показываем стрелки если проектов больше чем видно на экране (2 на мобильной, 6 на больших экранах)
  const showArrows = projects.length > 2;

  if (!projects.length) {
    return null;
  }

  return (
    <section className={styles.relatedSection} aria-label="Другие проекты">
      {showArrows ? (
        <>
          <button
            type="button"
            className={`${styles.relatedArrow} ${styles.relatedArrowPrev}`}
            ref={prevRef}
            aria-label="Предыдущие работы"
          />
          <button
            type="button"
            className={`${styles.relatedArrow} ${styles.relatedArrowNext}`}
            ref={nextRef}
            aria-label="Следующие работы"
          />
        </>
      ) : null}
      <Swiper
        modules={[Navigation]}
        spaceBetween={8}
        slidesPerView={2}
        slidesPerGroup={1}
        navigation={
          showArrows
            ? {
                prevEl: undefined,
                nextEl: undefined,
              }
            : undefined
        }
        onBeforeInit={(swiper) => {
          if (!showArrows) {
            return;
          }
          const navigation = swiper.params.navigation;
          if (typeof navigation !== "boolean" && navigation) {
            navigation.prevEl = prevRef.current;
            navigation.nextEl = nextRef.current;
          }
          swiper.navigation.init();
          swiper.navigation.update();
        }}
        allowTouchMove={projects.length > 1}
        loop={false}
        watchOverflow
        breakpoints={{
          640: { slidesPerView: 2, spaceBetween: 8 },
          900: { slidesPerView: 3, spaceBetween: 10 },
          1200: { slidesPerView: 4, spaceBetween: 10 },
          1440: { slidesPerView: 6, spaceBetween: 10 },
          1800: { slidesPerView: 6, spaceBetween: 12 },
        }}
        className={styles.relatedSwiper}
      >
        {projects.map((project) => (
          <SwiperSlide key={project.slug} className={styles.relatedTileSlide}>
            <Link href={`/${project.slug}`} className={styles.relatedTile} prefetch={false}>
              <div className={styles.relatedTileImage}>
                {project.heroImageUrl ? (
                  <Image
                    src={project.heroImageUrl}
                    alt={project.title}
                    fill
                    sizes="(max-width: 768px) 50vw, 240px"
                    className={styles.relatedImage}
                    priority={false}
                  />
                ) : (
                  <div className={styles.relatedImageFallback} aria-hidden="true" />
                )}
              </div>
              <p className={styles.relatedTileMeta}>
                <span className={styles.relatedTileTitle}>{project.title}</span>
              </p>
            </Link>
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}

