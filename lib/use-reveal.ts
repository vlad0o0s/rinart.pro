'use client';

import { useEffect, useRef } from "react";

type RevealOptions = {
  rootMargin?: string;
  threshold?: number;
};

export function useReveal<T extends HTMLElement>({
  rootMargin = "0px 0px -10% 0px",
  threshold = 0.2,
}: RevealOptions = {}) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    if (!node.dataset.visible) {
      node.dataset.visible = "false";
    }

    const reveal = () => {
      node.dataset.visible = "true";
    };

    if (typeof IntersectionObserver === "undefined") {
      reveal();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal();
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin, threshold },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [rootMargin, threshold]);

  return ref;
}


