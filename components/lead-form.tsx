"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GOAL_FORM_OPEN, reachGoal } from "@/lib/analytics";
import type { QuizContext } from "@/lib/lead-validation";
import { LeadFormBody } from "./lead-form-body";
import { useLeadForm } from "./use-lead-form";
import styles from "./lead-form.module.css";

/**
 * Кнопка «Оставить заявку» + модальная форма.
 *
 * Поля, валидация, капча и состояния живут в `useLeadForm` — тот же хук использует
 * встроенная форма под квизом. Здесь остаётся только поведение диалога: открытие,
 * Escape, блокировка прокрутки и возврат фокуса.
 */

type LeadFormProps = {
  source: string;
  title?: string;
  subtitle?: string;
  placement?: "default" | "hero" | "project" | "contact";
  openButtonClassName?: string;
  preserveOpenButtonStyle?: boolean;
  openButtonLabel?: string;
  submitLabel?: string;
  quiz?: QuizContext | null;
};

export function LeadForm({
  source,
  title = "Напишите нам",
  subtitle = "Оставьте телефон — Ринат свяжется с вами, уточнит задачу и посчитает стоимость.",
  placement = "default",
  openButtonClassName,
  preserveOpenButtonStyle = false,
  openButtonLabel = "Оставить заявку",
  submitLabel = "Отправить заявку",
  quiz = null,
}: LeadFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const form = useLeadForm({ source, quiz });

  const placementClass = {
    default: "",
    hero: styles.sectionHero,
    project: styles.sectionProject,
    contact: styles.sectionContact,
  }[placement];

  const openButtonClass = [
    styles.openButton,
    preserveOpenButtonStyle ? styles.preserveOpenButtonStyle : "",
    openButtonClassName ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  function openModal() {
    setIsOpen(true);
    reachGoal(GOAL_FORM_OPEN, { source });
  }

  /**
   * Закрытие не стирает введённое: случайный клик по подложке раньше означал, что имя
   * и телефон нужно набирать заново. Сбрасываем только состояние отправки, а после
   * успешной заявки — и его тоже, чтобы следующее открытие начиналось с чистой формы.
   */
  const closeModal = useCallback(() => {
    setIsOpen(false);
    form.reset();
  }, [form]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeModal();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    // Фокус в первое пустое поле: на мобильных это сразу открывает клавиатуру
    // и убирает лишний тап.
    const focusTimer = setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLInputElement>(
        "input:not([type='hidden']):not([aria-hidden='true'])",
      );
      target?.focus();
    }, 40);

    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeModal, isOpen]);

  // Возврат фокуса на кнопку, с которой всё началось: иначе после закрытия
  // фокус улетает в начало документа. Только после реального открытия — на первом
  // рендере страницы фокус трогать нельзя.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      return;
    }

    if (wasOpenRef.current) {
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, [isOpen]);

  const modal = isOpen ? (
    <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button
        className={styles.backdrop}
        type="button"
        aria-label="Закрыть форму"
        onClick={closeModal}
      />

      <div className={styles.panel} ref={panelRef}>
        <button className={styles.close} type="button" aria-label="Закрыть форму" onClick={closeModal}>
          ×
        </button>

        <div className={styles.header}>
          <h2 className={styles.title} id={titleId}>
            {form.status === "success" ? "Заявка отправлена" : title}
          </h2>
          {form.status === "success" ? null : <p className={styles.subtitle}>{subtitle}</p>}
        </div>

        <LeadFormBody
          form={form}
          submitLabel={submitLabel}
          successSlot={
            <button className={styles.submit} type="button" onClick={closeModal}>
              Закрыть
            </button>
          }
        />
      </div>
    </div>
  ) : null;

  return (
    <section className={`${styles.section} ${placementClass}`} aria-labelledby={titleId}>
      <button className={openButtonClass} type="button" onClick={openModal} ref={triggerRef}>
        {openButtonLabel}
      </button>

      {modal ? createPortal(modal, document.body) : null}
    </section>
  );
}
