"use client";

import { useEffect } from "react";

// Трекер обращений: ловит клики по ссылкам MAX и Telegram на лендинге
// и шлёт цели в Яндекс.Метрику. Нужен потому, что главный CTA — мессенджер MAX,
// а отслеживалась только отправка формы. Цели создать в Метрике:
//   max_click  — JS-событие, идентификатор "max_click"
//   tg_click   — JS-событие, идентификатор "tg_click"
const COUNTER_ID = 105099236;

declare global {
  interface Window {
    ym?: (...args: unknown[]) => void;
  }
}

export function ContactTracker() {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const link = target?.closest?.("a") as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.href || "";
      if (href.includes("max.ru")) {
        window.ym?.(COUNTER_ID, "reachGoal", "max_click");
      } else if (href.includes("t.me")) {
        window.ym?.(COUNTER_ID, "reachGoal", "tg_click");
      }
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);

  return null;
}
