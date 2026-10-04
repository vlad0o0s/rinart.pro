"use client";

import { InvisibleSmartCaptcha } from "@yandex/smart-captcha";
import { useEffect, useId, useRef } from "react";
import { PHONE_HREF, PHONE_LABEL, TELEGRAM_HREF } from "@/lib/contacts";
import { LEGAL_PATHS } from "@/lib/legal";
import { SMARTCAPTCHA_SITE_KEY } from "@/lib/smart-captcha-site-key";
import type { useLeadForm } from "./use-lead-form";
import styles from "./lead-form.module.css";

/**
 * Поля заявки без обёртки. Модалка показывает их внутри диалога, встроенная форма —
 * прямо под расчётом квиза. Разметка, состояния и тексты при этом одни и те же.
 */

/**
 * Класс Метрики: Вебвизор не записывает, что набрано в поле. Имя и телефон в записи
 * посещений попадать не должны — этого требуют и условия сервиса.
 */
const NO_KEYSTROKE_RECORDING = "ym-disable-keys";

type LeadFormBodyProps = {
  form: ReturnType<typeof useLeadForm>;
  /** Текст основной кнопки: на лендинге он продаёт результат, а не действие. */
  submitLabel: string;
  /** Что показать после успешной отправки вместо формы. */
  successSlot?: React.ReactNode;
};

export function LeadFormBody({ form, submitLabel, successSlot }: LeadFormBodyProps) {
  const nameId = useId();
  const phoneId = useId();
  const consentId = useId();
  const successRef = useRef<HTMLDivElement | null>(null);

  const isSending = form.status === "sending";

  // На телефоне форма часто длиннее экрана, и после отправки подтверждение оказывалось
  // выше или ниже видимой области — человек не понимал, ушла заявка или нет.
  useEffect(() => {
    if (form.status === "success") {
      successRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [form.status]);

  if (form.status === "success") {
    return (
      <div className={styles.success} role="status" aria-live="polite" ref={successRef}>
        <span className={styles.successMark} aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12.5 10 17.5 19 7"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <p className={styles.successTitle}>
          Спасибо! Ринат свяжется с вами в течение рабочего дня
        </p>
        {successSlot}
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={form.submit} noValidate>
      <div className={styles.fields}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={nameId}>
            Имя
          </label>
          <input
            id={nameId}
            className={`${styles.input} ${NO_KEYSTROKE_RECORDING}`}
            type="text"
            name="name"
            autoComplete="name"
            value={form.name}
            onChange={(event) => form.setName(event.target.value)}
            onFocus={form.armCaptcha}
            placeholder="Как к вам обращаться"
            maxLength={80}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={phoneId}>
            Телефон *
          </label>
          <input
            id={phoneId}
            className={`${styles.input} ${NO_KEYSTROKE_RECORDING}`}
            type="tel"
            name="phone"
            autoComplete="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(event) => form.handlePhoneChange(event.target.value)}
            onFocus={form.handlePhoneFocus}
            onBlur={form.handlePhoneBlur}
            placeholder="+7 (___) ___-__-__"
            maxLength={18}
            required
            aria-required="true"
          />
        </div>
      </div>

      {/* Honeypot: настоящие люди этого поля не видят и не заполняют. */}
      <input
        type="text"
        name="company"
        value={form.company}
        onChange={(event) => form.setCompany(event.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className={styles.honeypot}
      />

      <div className={styles.consent}>
        <input
          id={consentId}
          className={styles.consentBox}
          type="checkbox"
          checked={form.consent}
          onChange={(event) => form.setConsent(event.target.checked)}
          onFocus={form.armCaptcha}
          required
          aria-required="true"
        />
        <label className={styles.consentText} htmlFor={consentId}>
          {/* Подпись — флекс-контейнер: без общей обёртки текст и ссылка становятся
              отдельными элементами, и пробел между ними пропадает. */}
          <span>
            Даю{" "}
            <a href={LEGAL_PATHS.consent} target="_blank" rel="noopener noreferrer">
              согласие на обработку персональных данных
            </a>
          </span>
        </label>
      </div>

      {/* Ссылка на политику — отдельной строкой: галочка подтверждает только согласие,
          а не «согласие и ознакомление» разом. */}
      <p className={styles.policyNote}>
        Как мы обрабатываем и защищаем данные — в{" "}
        <a href={LEGAL_PATHS.privacy} target="_blank" rel="noopener noreferrer">
          политике конфиденциальности
        </a>
        .
      </p>

      {/* Скрипт капчи подключается только после первого касания формы, чтобы не
          замедлять страницу тем, кто до формы не дошёл. */}
      {form.captcha.armed ? (
        <div className={styles.captcha}>
          <InvisibleSmartCaptcha
            key={form.captcha.nonce}
            sitekey={SMARTCAPTCHA_SITE_KEY}
            visible={form.captcha.visible}
            onSuccess={form.captcha.onSuccess}
            onTokenExpired={form.captcha.onTokenExpired}
            onChallengeHidden={() => form.captcha.onUnavailable("challenge_hidden")}
            onNetworkError={() => form.captcha.onUnavailable("network")}
            onJavascriptError={() => form.captcha.onUnavailable("script")}
          />
        </div>
      ) : null}

      <button className={styles.submit} type="submit" disabled={isSending}>
        {isSending ? "Отправляем…" : submitLabel}
      </button>

      {/* Область объявлений для скринридера: сюда попадает и ошибка, и успех. */}
      <div className={styles.status} role="status" aria-live="polite">
        {form.status === "error" && form.errorMessage ? (
          <div className={styles.error}>
            <p className={styles.errorText}>{form.errorMessage}</p>
            <div className={styles.errorActions}>
              <button
                type="button"
                className={styles.retry}
                onClick={() => form.submit()}
                disabled={isSending}
              >
                Попробовать ещё раз
              </button>
              <a className={styles.errorLink} href={PHONE_HREF}>
                {PHONE_LABEL}
              </a>
              <a
                className={styles.errorLink}
                href={TELEGRAM_HREF}
                target="_blank"
                rel="noopener noreferrer"
              >
                Telegram
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </form>
  );
}
