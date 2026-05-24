"use client";

import { SmartCaptcha } from "@yandex/smart-captcha";
import { FormEvent, useEffect, useId, useMemo, useState } from "react";
import styles from "./lead-form.module.css";

const CAPTCHA_SITE_KEY = "ysc1_kSspdc4CreezvRnhYrKOF8CfF79arnKlhequLaHL7fe55cea";
const METRIKA_COUNTER_ID = 105099236;
const GOAL_FORM_OPEN = "lead_form_open";
const GOAL_FORM_SUBMIT = "lead_form_submit";

type LeadFormProps = {
  source: string;
  title?: string;
  subtitle?: string;
  placement?: "default" | "hero";
};

type SubmitState = "idle" | "submitting" | "success" | "error";

type WindowWithMetrika = Window & {
  ym?: (counterId: number, method: "reachGoal", target: string, params?: Record<string, string>) => void;
};

function reachMetrikaGoal(target: string, source: string) {
  if (typeof window === "undefined") {
    return;
  }

  const { ym } = window as WindowWithMetrika;

  if (typeof ym !== "function") {
    return;
  }

  ym(METRIKA_COUNTER_ID, "reachGoal", target, { source });
}

function getPhoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  const withoutCountry = digits.startsWith("8") ? digits.slice(1) : digits.startsWith("7") ? digits.slice(1) : digits;
  return withoutCountry.slice(0, 10);
}

function formatPhone(value: string) {
  const digits = getPhoneDigits(value);
  const area = digits.slice(0, 3);
  const prefix = digits.slice(3, 6);
  const firstPair = digits.slice(6, 8);
  const secondPair = digits.slice(8, 10);

  if (!digits.length) {
    return "";
  }

  let formatted = "+7";

  if (area) {
    formatted += ` (${area}`;
  }

  if (area.length === 3) {
    formatted += ")";
  }

  if (prefix) {
    formatted += ` ${prefix}`;
  }

  if (firstPair) {
    formatted += `-${firstPair}`;
  }

  if (secondPair) {
    formatted += `-${secondPair}`;
  }

  return formatted;
}

export function LeadForm({
  source,
  title = "Напишите нам",
  subtitle = "Оставьте имя и телефон, мы свяжемся с вами и ответим на вопросы.",
  placement = "default",
}: LeadFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaNonce, setCaptchaNonce] = useState(0);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();
  const captchaKey = useMemo(() => `${source}-${captchaNonce}`, [source, captchaNonce]);

  function openModal() {
    setIsOpen(true);
    reachMetrikaGoal(GOAL_FORM_OPEN, source);
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim() || !phone.trim()) {
      setSubmitState("error");
      setMessage("Заполните имя и телефон.");
      return;
    }

    if (!captchaToken) {
      setSubmitState("error");
      setMessage("Подтвердите, что вы не робот.");
      return;
    }

    setSubmitState("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          phone,
          source,
          captchaToken,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message || "Не удалось отправить заявку.");
      }

      setName("");
      setPhone("");
      setCaptchaToken("");
      setCaptchaNonce((value) => value + 1);
      setSubmitState("success");
      setMessage("Заявка отправлена. Мы скоро свяжемся с вами.");
      reachMetrikaGoal(GOAL_FORM_SUBMIT, source);
    } catch (error) {
      setCaptchaToken("");
      setCaptchaNonce((value) => value + 1);
      setSubmitState("error");
      setMessage(error instanceof Error ? error.message : "Не удалось отправить заявку.");
    }
  }

  function handlePhoneChange(value: string) {
    setPhone(formatPhone(value));
  }

  function handlePhoneFocus() {
    if (!phone) {
      setPhone("+7 ");
    }
  }

  function handlePhoneBlur() {
    if (!getPhoneDigits(phone).length) {
      setPhone("");
    }
  }

  return (
    <section className={`${styles.section} ${placement === "hero" ? styles.sectionHero : ""}`} aria-labelledby={titleId}>
      <button className={styles.openButton} type="button" onClick={openModal}>
        Оставить заявку
      </button>

      {isOpen ? (
        <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <button className={styles.backdrop} type="button" aria-label="Закрыть форму" onClick={() => setIsOpen(false)} />

          <div className={styles.panel}>
            <button className={styles.close} type="button" aria-label="Закрыть форму" onClick={() => setIsOpen(false)}>
              ×
            </button>

            <div className={styles.header}>
              <h2 className={styles.title} id={titleId}>
                {title}
              </h2>
              <p className={styles.subtitle}>{subtitle}</p>
            </div>

            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.fields}>
                <label className={styles.field}>
                  <span className={styles.label}>Имя *</span>
                  <input
                    className={styles.input}
                    type="text"
                    name="name"
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Имя"
                    required
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Телефон *</span>
                  <input
                    className={styles.input}
                    type="tel"
                    name="phone"
                    autoComplete="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(event) => handlePhoneChange(event.target.value)}
                    onFocus={handlePhoneFocus}
                    onBlur={handlePhoneBlur}
                    placeholder="+7 (___) ___-__-__"
                    maxLength={18}
                    required
                  />
                </label>
              </div>

              <div className={styles.captcha}>
                <SmartCaptcha key={captchaKey} sitekey={CAPTCHA_SITE_KEY} onSuccess={setCaptchaToken} />
              </div>

              <button className={styles.submit} type="submit" disabled={submitState === "submitting"}>
                {submitState === "submitting" ? "Отправляем" : "Отправить"}
              </button>

              {message ? (
                <p className={`${styles.message} ${submitState === "success" ? styles.messageSuccess : styles.messageError}`}>
                  {message}
                </p>
              ) : null}
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
