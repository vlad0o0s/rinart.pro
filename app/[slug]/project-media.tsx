"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode, Mousewheel } from "swiper/modules";
import { useReveal } from "@/lib/use-reveal";
import styles from "./page.module.css";

type Scheme = {
  title: string;
  image: string;
};

type MediaItem = {
  src: string;
  caption?: string;
  alt: string;
  type: "feature" | "scheme" | "gallery";
};

type ProjectMediaProps = {
  title: string;
  featureImage?: string | null;
  schemes: Scheme[];
  gallery: string[];
  infoHeight?: number | null;
};

export function ProjectMedia({ title, featureImage, schemes, gallery, infoHeight }: ProjectMediaProps) {
  const mediaItems = useMemo<MediaItem[]>(() => {
    const items: MediaItem[] = [];

    if (featureImage) {
      items.push({ src: featureImage, caption: title, alt: title, type: "feature" });
    }

    schemes.forEach((scheme) => {
      const schemeAlt = scheme.title ? `${title} — ${scheme.title}` : title;
      items.push({ src: scheme.image, caption: scheme.title, alt: schemeAlt, type: "scheme" });
    });

    gallery.forEach((src) => {
      if (!items.some((item) => item.src === src)) {
        const galleryAlt = title;
        items.push({ src, caption: title, alt: galleryAlt, type: "gallery" });
      }
    });

    return items;
  }, [featureImage, gallery, schemes, title]);

  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const closeModal = useCallback(() => {
    setActiveIndex(null);
  }, []);

  const showPrev = useCallback(() => {
    setActiveIndex((index) => {
      if (index === null) return index;
      if (mediaItems.length <= 1) {
        return index;
      }
      return index === 0 ? mediaItems.length - 1 : index - 1;
    });
  }, [mediaItems.length]);

  const showNext = useCallback(() => {
    setActiveIndex((index) => {
      if (index === null) return index;
      if (mediaItems.length <= 1) {
        return index;
      }
      return index === mediaItems.length - 1 ? 0 : index + 1;
    });
  }, [mediaItems.length]);

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeModal();
      } else if (event.key === "ArrowLeft") {
        showPrev();
      } else if (event.key === "ArrowRight") {
        showNext();
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [activeIndex, closeModal, showNext, showPrev]);

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [activeIndex]);

  const desktopRef = useReveal<HTMLDivElement>({ threshold: 0.15 });
  const mobileRef = useReveal<HTMLDivElement>({ threshold: 0.1 });

  if (!mediaItems.length) {
    return null;
  }

  const columnStyle = infoHeight
    ? ({ height: `${infoHeight}px`, maxHeight: `${infoHeight}px` } as CSSProperties)
    : undefined;
  const activeItem = activeIndex !== null ? mediaItems[activeIndex] : null;

  return (
    <>
      <div className={styles.mediaColumnDesktop} ref={desktopRef} data-visible="false" style={columnStyle}>
        <Swiper
          modules={[FreeMode, Mousewheel]}
          direction="vertical"
          slidesPerView={1.1}
          spaceBetween={20}
          loop={mediaItems.length > 1}
          freeMode={{
            enabled: true,
            momentum: true,
            momentumVelocityRatio: 0.6,
          }}
          mousewheel={{ forceToAxis: true, releaseOnEdges: false }}
          className={styles.mediaSwiper}
        >
          {mediaItems.map((item, index) => (
            <SwiperSlide key={`${item.src}-${index}`} className={styles.mediaSlide}>
              <figure
                className={styles.mediaFrame}
                style={{ "--media-index": index } as CSSProperties}
              >
                <Image
                  src={item.src}
                  alt={item.alt}
                  className={styles.mediaImage}
                  loading="lazy"
                  width={1600}
                  height={1000}
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  unoptimized
                  onClick={() => setActiveIndex(index)}
                />
                {item.type === "scheme" && item.caption ? (
                  <figcaption className={styles.mediaCaption}>{item.caption}</figcaption>
                ) : null}
              </figure>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      <div className={styles.mediaColumnMobile} ref={mobileRef} data-visible="false">
        {mediaItems.map((item, index) => (
          <figure key={`${item.src}-mobile-${index}`} className={styles.mediaFrame}>
            <Image
              src={item.src}
              alt={item.alt}
              className={styles.mediaImage}
              loading="lazy"
              width={1600}
              height={1000}
              sizes="100vw"
              unoptimized
              onClick={() => setActiveIndex(index)}
            />
            {item.type === "scheme" && item.caption ? (
              <figcaption className={styles.mediaCaption}>{item.caption}</figcaption>
            ) : null}
          </figure>
        ))}
      </div>

      {activeItem ? (
        <div className={`${styles.modal} ${styles.modalOpen}`} role="dialog" aria-modal="true">
          <button type="button" className={styles.modalClose} onClick={closeModal} aria-label="Закрыть">
            ×
          </button>
          <button
            type="button"
            className={`${styles.modalNav} ${styles.modalPrev}`}
            onClick={showPrev}
            disabled={mediaItems.length <= 1}
            aria-label="Предыдущее изображение"
          >
            &#10094;
          </button>
          <figure key={activeItem.src} className={styles.modalInner}>
            <Image
              src={activeItem.src}
              alt={activeItem.alt}
              className={styles.modalImage}
              width={1920}
              height={1200}
              sizes="100vw"
              unoptimized
            />
            {activeItem.caption ? (
              <figcaption className={styles.modalCaption}>{activeItem.caption}</figcaption>
            ) : null}
          </figure>
          <button
            type="button"
            className={`${styles.modalNav} ${styles.modalNext}`}
            onClick={showNext}
            disabled={mediaItems.length <= 1}
            aria-label="Следующее изображение"
          >
            &#10095;
          </button>
          <div className={styles.modalBackdrop} onClick={closeModal} />
        </div>
      ) : null}
    </>
  );
}
