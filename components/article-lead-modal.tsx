"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GOAL_ARTICLE_MODAL_SHOW, GOAL_FORM_OPEN, reachGoal } from "@/lib/analytics";
import {
  ARTICLE_LEAD_EVENT,
  ARTICLE_LEAD_HASH,
  AUTO_OPEN_MIN_SECONDS,
  AUTO_OPEN_SCROLL_SHARE,
  EXIT_INTENT_MIN_SECONDS,
  articleLeadSource,
  canAutoOpen,
  readingShare,
  type ArticleLeadTrigger,
} from "@/lib/article-lead-modal";
import { markArticleLeadDismissed, markArticleLeadShown, readArticleLeadMemory } from "@/lib/article-lead-memory";
import { LeadFormBody } from "./lead-form-body";
import { useLeadForm } from "./use-lead-form";
import formStyles from "./lead-form.module.css";
import styles from "./article-lead-modal.module.css";

/**
 * Окно заявки в статье.
 *
 * Открывается тремя путями: само — когда человек прочитал больше половины текста или
 * собрался уходить; по кнопке блока в середине статьи; по ссылке «#zayavka» в тексте.
 * Само — один раз за визит, не раньше чем через полминуты и не тому, кто уже закрывал
 * окно на этой неделе или оставил заявку. Правила показа лежат в lib/article-lead-modal.ts.
 *
 * Поля и отправка — общий хук useLeadForm, как у остальных форм сайта.
 */

type ArticleLeadModalProps = {
  articleTitle: string;
  title: string;
  text: string;
  submitLabel: string;
  /** Разрешено ли окну открываться самому. По кнопке и ссылке оно открывается всегда. */
  autoOpen: boolean;
};

const FOCUSABLE = "a[href], button:not([disabled]), input:not([type='hidden']):not([aria-hidden='true']):not([disabled])";

/** Занят ли человек чем-то, чему окно помешает: другой диалог, открытое меню или набор текста. */
function isBusy(): boolean {
  // Меню и остальные окна сайта на время показа запирают прокрутку страницы.
  if (document.hidden || document.body.style.overflow === "hidden" || document.querySelector("[role='dialog']")) {
    return true;
  }
  const active = document.activeElement;
  return active instanceof HTMLElement && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName));
}

export function ArticleLeadModal({ articleTitle, title, text, submitLabel, autoOpen }: ArticleLeadModalProps) {
  const [trigger, setTrigger] = useState<ArticleLeadTrigger | null>(null);
  const isOpen = trigger !== null;
  const openedByReader = trigger === "inline" || trigger === "link";
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  /** Куда вернуть фокус после закрытия: кнопка или ссылка, с которой окно открыли. */
  const openerRef = useRef<HTMLElement | null>(null);
  const form = useLeadForm({ source: articleLeadSource(articleTitle, trigger ?? "scroll") });

  // Окно открывается само.
  useEffect(() => {
    if (!autoOpen || !canAutoOpen(readArticleLeadMemory(), Date.now())) {
      return;
    }

    const startedAt = Date.now();
    const secondsOnPage = () => (Date.now() - startedAt) / 1000;
    let opened = false;

    function open(kind: "scroll" | "exit") {
      if (opened || isBusy()) {
        return;
      }
      opened = true;
      stop();
      markArticleLeadShown();
      openerRef.current = null;
      setTrigger(kind);
      reachGoal(GOAL_ARTICLE_MODAL_SHOW, { trigger: kind });
    }

    function checkReading() {
      if (secondsOnPage() < AUTO_OPEN_MIN_SECONDS) {
        return;
      }
      const body = document.querySelector<HTMLElement>("[data-article-body]");
      if (!body) {
        return;
      }
      const rect = body.getBoundingClientRect();
      if (readingShare(rect.top, rect.height, window.innerHeight) >= AUTO_OPEN_SCROLL_SHARE) {
        open("scroll");
      }
    }

    // Курсор ушёл вверх, к вкладкам и адресной строке. На тачскрине такого жеста нет.
    function checkExit(event: MouseEvent) {
      if (event.relatedTarget === null && event.clientY <= 0 && secondsOnPage() >= EXIT_INTENT_MIN_SECONDS) {
        open("exit");
      }
    }

    // Человек мог дочитать до середины раньше, чем прошло время, и замереть над текстом:
    // прокрутки больше не будет, поэтому проверяем ещё раз, когда время выйдет.
    const timer = window.setTimeout(checkReading, AUTO_OPEN_MIN_SECONDS * 1000 + 100);
    const hasMouse = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    window.addEventListener("scroll", checkReading, { passive: true });
    document.addEventListener("visibilitychange", checkReading);
    if (hasMouse) {
      document.addEventListener("mouseout", checkExit);
    }

    function stop() {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", checkReading);
      document.removeEventListener("visibilitychange", checkReading);
      document.removeEventListener("mouseout", checkExit);
    }

    return stop;
  }, [autoOpen]);

  // Окно открывает сам читатель: кнопкой блока в тексте или ссылкой «#zayavka».
  useEffect(() => {
    function open(kind: "inline" | "link", opener: HTMLElement | null) {
      openerRef.current = opener;
      markArticleLeadShown();
      setTrigger(kind);
      reachGoal(GOAL_FORM_OPEN, { source: articleLeadSource(articleTitle, kind) });
    }

    function handleCtaEvent() {
      open("inline", document.activeElement instanceof HTMLElement ? document.activeElement : null);
    }

    function handleLinkClick(event: MouseEvent) {
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link) {
        return;
      }
      const url = new URL(link.href, window.location.href);
      if (url.hash !== ARTICLE_LEAD_HASH || url.pathname !== window.location.pathname) {
        return;
      }
      event.preventDefault();
      open("link", link);
    }

    window.addEventListener(ARTICLE_LEAD_EVENT, handleCtaEvent);
    document.addEventListener("click", handleLinkClick);
    // Адрес статьи с «#zayavka» на конце открывает окно сразу — так его удобно проверить
    // и так на форму можно сослаться извне.
    const hashTimer = window.location.hash === ARTICLE_LEAD_HASH ? window.setTimeout(() => open("link", null), 0) : null;

    return () => {
      window.removeEventListener(ARTICLE_LEAD_EVENT, handleCtaEvent);
      document.removeEventListener("click", handleLinkClick);
      if (hashTimer !== null) {
        window.clearTimeout(hashTimer);
      }
    };
  }, [articleTitle]);

  /**
   * Закрытие без заявки запоминается: человеку, который отказался, окно неделю не
   * открывается само. Введённое при этом не стирается — как в остальных формах сайта.
   */
  const close = useCallback(() => {
    if (form.status !== "success") {
      markArticleLeadDismissed();
    }
    setTrigger(null);
    form.reset();
    openerRef.current?.focus({ preventScroll: true });
  }, [form]);

  // Прокрутка страницы и фокус — один раз на каждое открытие. Отдельно от клавиатуры:
  // обработчик клавиш зависит от close, а тот меняется при каждом вводе в поле, и общий
  // эффект после каждой буквы возвращал бы фокус в первое поле.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Читатель сам открыл окно — фокус сразу в поле, на телефоне появится клавиатура.
    // Окно открылось само — фокус на нём самом: клавиатура, закрывшая пол-экрана
    // без спроса, выглядит как поломка.
    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      const field = openedByReader ? panel?.querySelector<HTMLInputElement>("input:not([type='hidden']):not([aria-hidden='true'])") : null;
      (field ?? panel)?.focus({ preventScroll: true });
    }, 40);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, openedByReader]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) {
        return;
      }
      // Фокус не уходит за окно, пока оно открыто.
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) {
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close, isOpen]);

  if (!isOpen) {
    return null;
  }

  const sent = form.status === "success";

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button className={styles.backdrop} type="button" aria-label="Закрыть окно" tabIndex={-1} onClick={close} />

      <div className={styles.panel} ref={panelRef} tabIndex={-1}>
        <button className={styles.close} type="button" aria-label="Закрыть окно" onClick={close}>
          ×
        </button>

        <div className={styles.header}>
          <h2 className={styles.title} id={titleId}>
            {sent ? "Заявка отправлена" : title}
          </h2>
          {sent ? null : <p className={styles.text}>{text}</p>}
        </div>

        <LeadFormBody
          form={form}
          submitLabel={submitLabel}
          successSlot={
            <button className={formStyles.submit} type="button" onClick={close}>
              Вернуться к статье
            </button>
          }
        />
      </div>
    </div>,
    document.body,
  );
}
