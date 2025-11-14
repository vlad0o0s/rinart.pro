"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function RouteReadyAnnouncer() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    let rafOne: number | null = null;
    let rafTwo: number | null = null;

    rafOne = window.requestAnimationFrame(() => {
      rafTwo = window.requestAnimationFrame(() => {
        window.dispatchEvent(
          new CustomEvent("rinart:route-ready", {
            detail: { pathname },
          }),
        );
      });
    });

    return () => {
      if (rafOne !== null) {
        window.cancelAnimationFrame(rafOne);
      }
      if (rafTwo !== null) {
        window.cancelAnimationFrame(rafTwo);
      }
    };
  }, [pathname]);

  return null;
}

