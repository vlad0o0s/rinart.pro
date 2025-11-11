"use client";

import { useEffect, useRef } from "react";

const PRELOAD_FLAG = "preloadShown";

export function Preloader() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const bigColorRef = useRef<HTMLDivElement | null>(null);
  const topColorRef = useRef<HTMLDivElement | null>(null);
  const bottomColorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const wrapper = wrapperRef.current;
    const bigColor = bigColorRef.current;
    const topColor = topColorRef.current;
    const bottomColor = bottomColorRef.current;

    if (!wrapper || !bigColor || !topColor || !bottomColor) {
      return;
    }

    const root = document.documentElement;
    const alreadyShown = window.sessionStorage.getItem(PRELOAD_FLAG) === "true";

    if (alreadyShown) {
      wrapper.style.display = "none";
      root.dataset.preloadState = "complete";
      return;
    }

    root.dataset.preloadState = "running";
    wrapper.style.display = "block";
    bigColor.style.display = "block";

    const slideTimer = window.setTimeout(() => {
      bigColor.style.transition = "transform 1s ease";
      bigColor.style.transform = "translate3d(100%, 0, 0)";
    }, 100);

    const handleBigTransitionEnd = () => {
      bigColor.style.display = "none";
      topColor.style.transition = "transform 1s ease";
      bottomColor.style.transition = "transform 1s ease";
      topColor.style.transform = "translate3d(0, -100%, 0)";
      bottomColor.style.transform = "translate3d(0, 100%, 0)";
      root.dataset.preloadState = "revealing";
      window.dispatchEvent(new Event("preloader:reveal"));
    };

    const handleBottomTransitionEnd = () => {
      wrapper.style.display = "none";
      window.sessionStorage.setItem(PRELOAD_FLAG, "true");
      root.dataset.preloadState = "complete";
      window.dispatchEvent(new Event("preloader:complete"));
      cleanup();
    };

    const cleanup = () => {
      bigColor.removeEventListener("transitionend", handleBigTransitionEnd);
      bottomColor.removeEventListener("transitionend", handleBottomTransitionEnd);
      window.clearTimeout(slideTimer);
    };

    bigColor.addEventListener("transitionend", handleBigTransitionEnd, {
      once: true,
    });
    bottomColor.addEventListener("transitionend", handleBottomTransitionEnd, {
      once: true,
    });

    return cleanup;
  }, []);

  return (
    <div className="loading-wrapper" ref={wrapperRef} aria-hidden="true">
      <div className="big-color" ref={bigColorRef} />
      <div className="top-color" ref={topColorRef}>
        <div className="logo-line-wrapper" />
        <div className="line" />
      </div>
      <div className="botom-color" ref={bottomColorRef} />
    </div>
  );
}

