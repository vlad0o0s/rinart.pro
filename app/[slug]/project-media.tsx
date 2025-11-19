"use client";

import { SafeImage as Image } from "@/components/safe-image";
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

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

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

  // Используем больший rootMargin для предзагрузки изображений заранее
  const desktopRef = useReveal<HTMLDivElement>({ 
    threshold: 0.15,
    rootMargin: "0px 0px 200px 0px" // Предзагружаем за 200px до появления
  });
  const mobileRef = useReveal<HTMLDivElement>({ 
    threshold: 0.1,
    rootMargin: "0px 0px 200px 0px" // Предзагружаем за 200px до появления
  });

  if (!mediaItems.length) {
    return null;
  }

  const columnStyle = infoHeight
    ? ({ height: `${infoHeight}px`, maxHeight: `${infoHeight}px` } as CSSProperties)
    : undefined;
  const activeItem = activeIndex !== null ? mediaItems[activeIndex] : null;

  // Предзагружаем первые несколько изображений для более быстрой загрузки
  useEffect(() => {
    const preloadLinks: HTMLLinkElement[] = [];
    // Предзагружаем первые 5 изображений
    mediaItems.slice(0, 5).forEach((item) => {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = item.src;
      document.head.appendChild(link);
      preloadLinks.push(link);
    });

    return () => {
      preloadLinks.forEach((link) => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      });
    };
  }, [mediaItems]);

  // Настройка бесконечной прокрутки для десктопа
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const content = contentRef.current;
    if (!scrollContainer || !content || mediaItems.length <= 1) {
      return;
    }

    const isMobile = () => window.innerWidth <= 768;

    const adjustScrollHeight = () => {
      if (!isMobile() && infoHeight) {
        scrollContainer.style.height = `${infoHeight}px`;
        scrollContainer.style.maxHeight = `${infoHeight}px`;
      } else {
        scrollContainer.style.height = "auto";
        scrollContainer.style.maxHeight = "none";
      }
    };

    // Проверяем, не дублирован ли уже контент
    const hasCloned = scrollContainer.querySelector('[data-cloned="true"]');
    
    // Дублируем контент только на десктопе и только один раз
    if (!isMobile() && !hasCloned) {
      // Клонируем содержимое для бесконечной прокрутки
      const clonedContent = content.cloneNode(true) as HTMLDivElement;
      clonedContent.setAttribute("data-cloned", "true");
      scrollContainer.appendChild(clonedContent);
    }

    adjustScrollHeight();
    window.addEventListener("resize", adjustScrollHeight);

    // Обработка прокрутки колесом мыши только на десктопе
    if (!isMobile()) {
      const handleWheel = (event: WheelEvent) => {
        if (activeIndex === null) {
          // Прокрутка работает только если модальное окно закрыто
          event.preventDefault();
          scrollContainer.scrollTop += event.deltaY;

          const halfHeight = scrollContainer.scrollHeight / 2;

          if (scrollContainer.scrollTop >= halfHeight) {
            scrollContainer.scrollTop = 0;
          } else if (scrollContainer.scrollTop <= 0) {
            scrollContainer.scrollTop = halfHeight;
          }
        }
      };

      scrollContainer.addEventListener("wheel", handleWheel, { passive: false });

      return () => {
        window.removeEventListener("resize", adjustScrollHeight);
        scrollContainer.removeEventListener("wheel", handleWheel);
        // Удаляем клонированный контент при размонтировании
        const cloned = scrollContainer.querySelector('[data-cloned="true"]');
        if (cloned) {
          cloned.remove();
        }
      };
    }

    return () => {
      window.removeEventListener("resize", adjustScrollHeight);
    };
  }, [mediaItems.length, infoHeight, activeIndex]);

  return (
    <>
      <div className={styles.mediaColumnDesktop} ref={desktopRef} data-visible="false" style={columnStyle}>
        <div ref={scrollContainerRef} className={styles.scrollPc}>
          <div ref={contentRef} className={styles.scrollContent}>
            {mediaItems.map((item, index) => (
              <figure
                key={`${item.src}-${index}`}
                className={styles.mediaFrame}
                style={{ "--media-index": index } as CSSProperties}
              >
                <Image
                  src={item.src}
                  alt={item.alt}
                  className={styles.mediaImage}
                  loading={index < 3 ? "eager" : "lazy"}
                  fetchPriority={index < 2 ? "high" : undefined}
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
            ))}
          </div>
        </div>
      </div>

      <div className={styles.mediaColumnMobile} ref={mobileRef} data-visible="false">
        {mediaItems.map((item, index) => (
          <figure key={`${item.src}-mobile-${index}`} className={styles.mediaFrame}>
            <Image
              src={item.src}
              alt={item.alt}
              className={styles.mediaImage}
              loading={index < 3 ? "eager" : "lazy"}
              fetchPriority={index < 2 ? "high" : undefined}
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
