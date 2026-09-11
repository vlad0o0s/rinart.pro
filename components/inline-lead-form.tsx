"use client";

import { PHONE_HREF, PHONE_LABEL, TELEGRAM_HREF } from "@/lib/contacts";
import type { QuizContext } from "@/lib/lead-validation";
import { LeadFormBody } from "./lead-form-body";
import { useLeadForm } from "./use-lead-form";
import styles from "./lead-form.module.css";

/**
 * Форма прямо в потоке страницы — без кнопки-посредника и без модалки.
 *
 * Так она стоит под результатом квиза: человек уже увидел цену, и следующий шаг — поле
 * телефона, а не ещё один клик. Прежний путь «результат → кнопка → модалка → форма»
 * терял почти всех: из 32 дошедших до расчёта заявку оставили двое.
 */

type InlineLeadFormProps = {
  source: string;
  quiz?: QuizContext | null;
  submitLabel?: string;
  note?: string;
};

export function InlineLeadForm({
  source,
  quiz = null,
  submitLabel = "Получить точный расчёт и бесплатную консультацию",
  note = "Оставьте телефон — Ринат уточнит задачу, подготовит точный расчёт и проведёт бесплатную консультацию.",
}: InlineLeadFormProps) {
  const form = useLeadForm({ source, quiz });

  return (
    <div className={styles.inline}>
      {form.status === "success" ? null : <p className={styles.inlineNote}>{note}</p>}

      <LeadFormBody
        form={form}
        submitLabel={submitLabel}
        successSlot={
          <p className={styles.successNote}>
            Если вопрос срочный — звоните{" "}
            <a href={PHONE_HREF}>{PHONE_LABEL}</a> или пишите в{" "}
            <a href={TELEGRAM_HREF} target="_blank" rel="noopener noreferrer">
              Telegram
            </a>
            .
          </p>
        }
      />

      {form.status === "success" ? null : (
        <p className={styles.alternatives}>
          Или сразу свяжитесь с Ринатом:{" "}
          <a className={styles.alternativeLink} href={PHONE_HREF}>
            {PHONE_LABEL}
          </a>
          <span className={styles.alternativeSep} aria-hidden="true">
            ·
          </span>
          <a
            className={styles.alternativeLink}
            href={TELEGRAM_HREF}
            target="_blank"
            rel="noopener noreferrer"
          >
            Telegram
          </a>
        </p>
      )}
    </div>
  );
}
