"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [visibleItems, setVisibleItems] = useState<MediaItem[]>(mediaItems);

  const closeModal = useCallback(() => {
    setActiveIndex(null);
  }, []);

  const showPrev = useCallback(() => {
    setActiveIndex((index) => {
      if (index === null) return index;
      return Math.max(0, index - 1);
    });
  }, []);

  const showNext = useCallback(() => {
    setActiveIndex((index) => {
      if (index === null) return index;
      return Math.min(mediaItems.length - 1, index + 1);
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
    setVisibleItems(mediaItems);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [mediaItems]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !mediaItems.length) {
      return;
    }

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollTop + clientHeight >= scrollHeight - 200) {
        setVisibleItems((prev) => [...prev, ...mediaItems]);
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [mediaItems]);

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

  if (!visibleItems.length) {
    return null;
  }

  const mediaRef = useReveal<HTMLDivElement>({ threshold: 0.15 });
  const combinedRef = useCallback(
    (node: HTMLDivElement | null) => {
      scrollContainerRef.current = node;
      mediaRef.current = node;
    },
    [mediaRef],
  );

  const columnStyle = infoHeight
    ? ({ height: `${infoHeight}px`, maxHeight: `${infoHeight}px` } as CSSProperties)
    : undefined;
  const activeItem = activeIndex !== null ? mediaItems[activeIndex] : null;

  return (
    <>
      <div
        className={styles.mediaColumn}
        ref={combinedRef}
        data-visible="false"
        style={columnStyle}
      >
        <div className={styles.mediaScroller}>
          {visibleItems.map((item, index) => (
            <figure
              key={`${item.src}-${index}`}
              className={styles.mediaFrame}
              style={{ "--media-index": index } as CSSProperties}
            >
              <img
                src={item.src}
                alt={item.alt}
                className={styles.mediaImage}
                loading="lazy"
                onClick={() => setActiveIndex(index % mediaItems.length)}
              />
              {item.type === "scheme" && item.caption ? (
                <figcaption className={styles.mediaCaption}>{item.caption}</figcaption>
              ) : null}
            </figure>
          ))}
        </div>
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
            disabled={activeIndex === 0}
            aria-label="Предыдущее изображение"
          >
            &#10094;
          </button>
          <figure key={activeItem.src} className={styles.modalInner}>
            <img src={activeItem.src} alt={activeItem.alt} className={styles.modalImage} />
            {activeItem.caption ? (
              <figcaption className={styles.modalCaption}>{activeItem.caption}</figcaption>
            ) : null}
          </figure>
          <button
            type="button"
            className={`${styles.modalNav} ${styles.modalNext}`}
            onClick={showNext}
            disabled={activeIndex === mediaItems.length - 1}
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
