"use client";

/**
 * Единственная точка отправки целей в Яндекс.Метрику.
 *
 * Раньше `ym(...)` вызывался из трёх мест с тремя разными сигнатурами, и имя цели было
 * строкой по месту вызова — опечатка молча превращалась в несуществующую цель.
 *
 * Правило, которое здесь удерживается: в параметры цели не попадают имя, телефон и любой
 * свободный ввод пользователя. Ответы квиза — это выбор из фиксированного списка,
 * их отправлять можно.
 */

export const METRIKA_COUNTER_ID = 105099236;

declare global {
  interface Window {
    ym?: (...args: unknown[]) => void;
  }
}

/** Цели, которые уже заведены в интерфейсе Метрики — переименовывать нельзя. */
export const GOAL_FORM_OPEN = "lead_form_open";
export const GOAL_FORM_SUBMIT = "lead_form_submit";
export const GOAL_FORM_ERROR = "lead_form_error";
export const GOAL_QUIZ_COMPLETE = "quiz_complete";
export const GOAL_TG_CLICK = "tg_click";
export const GOAL_MAX_CLICK = "max_click";

/** Новые цели — их нужно создать в Метрике, старые Goal ID не переиспользовать. */
export const GOAL_PHONE_CLICK = "phone_click";
export const GOAL_QUIZ_START = "quiz_start";
export const GOAL_QUIZ_QUALIFIED = "quiz_qualified_200plus";
export const GOAL_CAPTCHA_UNAVAILABLE = "captcha_unavailable";
/** Окно заявки в статье открылось само; параметр trigger — scroll (дочитал) или exit (уходит). */
export const GOAL_ARTICLE_MODAL_SHOW = "article_modal_show";

/**
 * Цели ответов квиза (`quiz_area_*`, `quiz_timing_*`) заданы рядом с самими вариантами
 * в `app/lp/proekt-doma/quiz.tsx`: отдельная таблица «ответ → цель» ломается от одного
 * лишнего пробела или другого тире в подписи, и сбой был бы молчаливым.
 */

/**
 * Просмотр страницы при переходе внутри сайта. Первый просмотр вкладки отправляет `init`
 * в `components/yandex-metrika.tsx` — отсюда его слать нельзя, получится дубль.
 */
export function trackPageview(url: string, options: { referer?: string; title?: string }) {
  if (typeof window === "undefined") {
    return;
  }

  const { ym } = window;

  if (typeof ym !== "function") {
    return;
  }

  ym(METRIKA_COUNTER_ID, "hit", url, options);
}

export function reachGoal(goal: string, params?: Record<string, string>) {
  if (typeof window === "undefined") {
    return;
  }

  const { ym } = window;

  if (typeof ym !== "function") {
    return;
  }

  if (params) {
    ym(METRIKA_COUNTER_ID, "reachGoal", goal, params);
    return;
  }

  ym(METRIKA_COUNTER_ID, "reachGoal", goal);
}
