"use client";

import { useEffect } from "react";
import {
  GOAL_MAX_CLICK,
  GOAL_PHONE_CLICK,
  GOAL_TG_CLICK,
  reachGoal,
} from "@/lib/analytics";

/**
 * Трекер обращений мимо формы: мессенджеры и телефон.
 *
 * Слушатель один на весь документ, поэтому ссылки внутри модалки и внутри формы
 * (портал в `body`) считаются тоже — без дублирующих обработчиков на каждой ссылке
 * и, что важнее, без двойного счёта одного клика.
 *
 * Цели: max_click, tg_click, phone_click.
 */
export function ContactTracker() {
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.("a") as HTMLAnchorElement | null;

      if (!link) {
        return;
      }

      const href = link.getAttribute("href") || "";

      if (href.startsWith("tel:")) {
        reachGoal(GOAL_PHONE_CLICK);
        return;
      }

      if (href.includes("max.ru")) {
        reachGoal(GOAL_MAX_CLICK);
        return;
      }

      if (href.includes("t.me")) {
        reachGoal(GOAL_TG_CLICK);
      }
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);

  return null;
}
