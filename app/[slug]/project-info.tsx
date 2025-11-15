"use client";

import { useEffect, useRef } from "react";
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
        <RichText html={descriptionHtml} className={styles.description} />
      ) : descriptionParagraphs.length ? (
        <div className={styles.description}>
          {descriptionParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}


