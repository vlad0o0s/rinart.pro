"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { SafeImage as Image } from "@/components/safe-image";
import { RichText } from "@/components/rich-text";
import { useReveal } from "@/lib/use-reveal";
import styles from "./page.module.css";

type ProjectInfoProps = {
  title: string;
  descriptionHtml?: string | null;
  descriptionParagraphs: string[];
  onHeightChange?: (height: number | null) => void;
};

export function ProjectInfo({ title, descriptionHtml, descriptionParagraphs, onHeightChange }: ProjectInfoProps) {
  const infoRef = useReveal<HTMLDivElement>({ threshold: 0.2 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const descriptionRef = useRef<HTMLDivElement | null>(null);

  const descImages = useMemo<Array<{ src: string; alt: string }>>(() => {
    if (!descriptionHtml || !descriptionHtml.trim()) {
      return [];
    }
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(descriptionHtml, "text/html");
      const imgs = Array.from(doc.querySelectorAll("img")) as HTMLImageElement[];
      return imgs
        .map((img) => {
          const src = img.getAttribute("src") || "";
          const alt = img.getAttribute("alt") || title || "";
          return src ? { src, alt } : null;
        })
        .filter((v): v is { src: string; alt: string } => Boolean(v));
    } catch {
      return [];
    }
  }, [descriptionHtml, title]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const closeModal = useCallback(() => setActiveIndex(null), []);
  const showPrev = useCallback(() => {
    setActiveIndex((index) => {
      if (index === null) return index;
      if (descImages.length <= 1) return index;
      return index === 0 ? descImages.length - 1 : index - 1;
    });
  }, [descImages.length]);
  const showNext = useCallback(() => {
    setActiveIndex((index) => {
      if (index === null) return index;
      if (descImages.length <= 1) return index;
      return index === descImages.length - 1 ? 0 : index + 1;
    });
  }, [descImages.length]);

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
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeydown);
      document.body.style.overflow = originalOverflow;
    };
  }, [activeIndex, closeModal, showNext, showPrev]);

  useEffect(() => {
    const node = descriptionRef.current;
    if (!node) {
      return;
    }
    const imgs = Array.from(node.querySelectorAll("img")) as HTMLImageElement[];
    const handleClick = (event: Event) => {
      const target = event.currentTarget as HTMLImageElement;
      const src = target.getAttribute("src");
      if (!src) return;
      const index = descImages.findIndex((item) => item.src === src);
      if (index >= 0) {
        setActiveIndex(index);
      }
    };
    imgs.forEach((img) => {
      img.style.cursor = "pointer";
      img.addEventListener("click", handleClick);
    });
    return () => {
      imgs.forEach((img) => img.removeEventListener("click", handleClick));
    };
  }, [descImages]);

  useEffect(() => {
    if (!onHeightChange) {
      return;
    }
    const node = containerRef.current;
    if (!node) {
      return;
    }
    if (typeof ResizeObserver === "undefined") {
      onHeightChange(node.offsetHeight);
      return;
    }
    const observer = new ResizeObserver(() => {
      onHeightChange(node.offsetHeight);
    });
    observer.observe(node);
    onHeightChange(node.offsetHeight);
    return () => {
      observer.disconnect();
    };
  }, [onHeightChange]);

  return (
    <div
      ref={(node) => {
        infoRef.current = node;
        containerRef.current = node;
      }}
      className={styles.infoColumn}
      data-visible="false"
    >
      
      <h1 className={styles.title}>{title}</h1>

      {descriptionHtml ? (
        <div ref={descriptionRef}>
          <RichText html={descriptionHtml} className={styles.description} />
        </div>
      ) : descriptionParagraphs.length ? (
        <div className={styles.description}>
          {descriptionParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      ) : null}

      {activeIndex !== null && descImages[activeIndex]
        ? (typeof document !== "undefined"
            ? createPortal(
                <div className={`${styles.modal} ${styles.modalOpen}`} role="dialog" aria-modal="true">
                  <button type="button" className={styles.modalClose} onClick={closeModal} aria-label="Закрыть">
                    ×
                  </button>
                  <button
                    type="button"
                    className={`${styles.modalNav} ${styles.modalPrev}`}
                    onClick={showPrev}
                    disabled={descImages.length <= 1}
                    aria-label="Предыдущее изображение"
                  >
                    &#10094;
                  </button>
                  <figure key={descImages[activeIndex].src} className={styles.modalInner}>
                    <Image
                      src={descImages[activeIndex].src}
                      alt={descImages[activeIndex].alt}
                      className={styles.modalImage}
                      width={1920}
                      height={1200}
                      sizes="100vw"
                      unoptimized
                    />
                  </figure>
                  <button
                    type="button"
                    className={`${styles.modalNav} ${styles.modalNext}`}
                    onClick={showNext}
                    disabled={descImages.length <= 1}
                    aria-label="Следующее изображение"
                  >
                    &#10095;
                  </button>
                  <div className={styles.modalBackdrop} onClick={closeModal} />
                </div>,
                document.body,
              )
            : null)
        : null}
    </div>
  );
}


