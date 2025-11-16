"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function RouteReadyAnnouncer() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    const waitNextFrames = () =>
      new Promise<void>((resolve) => {
        let one: number | null = null;
        let two: number | null = null;
        one = window.requestAnimationFrame(() => {
          two = window.requestAnimationFrame(() => {
            if (!cancelled) resolve();
            if (two !== null) window.cancelAnimationFrame(two);
          });
          if (one !== null) window.cancelAnimationFrame(one);
        });
      });

    const isElementVisible = (el: Element) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0;
    };

    const waitForFirstImage = async (root: ParentNode, timeoutMs = 1500) => {
      const candidates = Array.from(root.querySelectorAll("img")).filter(isElementVisible);
      const img = candidates[0] as HTMLImageElement | undefined;
      if (!img) return;
      if (img.complete && img.naturalWidth > 0) return;
      if (typeof img.decode === "function") {
        await Promise.race([
          img.decode(),
          new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
        ]).catch(() => {});
      } else {
        await new Promise<void>((resolve) => setTimeout(resolve, Math.min(timeoutMs, 600)));
      }
    };

    (async () => {
      await waitNextFrames();

      const root =
        (document.querySelector("main") as HTMLElement | null) ||
        (document.querySelector("[data-first-content]") as HTMLElement | null) ||
        document.body;

      await waitForFirstImage(root);

      if (!cancelled) {
        window.dispatchEvent(
          new CustomEvent("rinart:route-ready", {
            detail: { pathname },
          }),
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}

