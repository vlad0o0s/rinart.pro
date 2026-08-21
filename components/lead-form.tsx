"use client";

import { InvisibleSmartCaptcha } from "@yandex/smart-captcha";
import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./lead-form.module.css";

const CAPTCHA_SITE_KEY = "ysc1_kSspdc4CreezvRnhYrKOF8CfF79arnKlhequLaHL7fe55cea";
const METRIKA_COUNTER_ID = 105099236;
const GOAL_FORM_OPEN = "lead_form_open";
const GOAL_FORM_SUBMIT = "lead_form_submit";
const GOAL_FORM_ERROR = "lead_form_error";
const CAPTCHA_FAILOPEN_TIMEOUT_MS = 3000;

type LeadFormProps = {
  source: string;
  title?: string;
  subtitle?: string;
  placement?: "default" | "hero" | "project" | "contact";
  openButtonClassName?: string;
  preserveOpenButtonStyle?: boolean;
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
  openButtonClassName,
  preserveOpenButtonStyle = false,
}: LeadFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [captchaVisible, setCaptchaVisible] = useState(false);
  const [captchaNonce, setCaptchaNonce] = useState(0);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();
  const captchaKey = useMemo(() => `${source}-${captchaNonce}`, [source, captchaNonce]);
  const captchaTokenRef = useRef("");
  const captchaTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitOnceRef = useRef(false);
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
    reachMetrikaGoal(GOAL_FORM_OPEN, source);
  }

  function closeModal() {
    setIsOpen(false);
    setSubmitState("idle");
    setMessage("");
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
        setSubmitState("idle");
        setMessage("");
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (captchaTimeoutRef.current) {
        clearTimeout(captchaTimeoutRef.current);
        captchaTimeoutRef.current = null;
      }
    };
  }, []);

  async function sendLead(token: string) {
    if (submitOnceRef.current) {
      return;
    }

    submitOnceRef.current = true;

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
          captchaToken: token,
          company,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message || "Не удалось отправить заявку.");
      }

      setName("");
      setPhone("");
      setCaptchaVisible(false);
      setCaptchaNonce((value) => value + 1);
      setSubmitState("success");
      setMessage("");
      reachMetrikaGoal(GOAL_FORM_SUBMIT, source);
    } catch (error) {
      setCaptchaVisible(false);
      setCaptchaNonce((value) => value + 1);
      setSubmitState("error");
      setMessage(error instanceof Error ? error.message : "Не удалось отправить заявку.");
      reachMetrikaGoal(GOAL_FORM_ERROR, source);
    } finally {
      submitOnceRef.current = false;
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim() || !phone.trim()) {
      setSubmitState("error");
      setMessage("Заполните имя и телефон.");
      return;
    }

    if (getPhoneDigits(phone).length !== 10) {
      setSubmitState("error");
      setMessage("Укажите номер телефона полностью.");
      return;
    }

    setSubmitState("submitting");
    setMessage("");

    // Токен уже получен заранее (виджет успел отработать в фоне) — отправляем сразу, без ожидания.
    if (captchaTokenRef.current) {
      const token = captchaTokenRef.current;
      captchaTokenRef.current = "";
      await sendLead(token);
      return;
    }

    // Токена ещё нет: показываем (запускаем) невидимую капчу и ждём токен максимум 3 секунды.
    setCaptchaVisible(true);

    if (captchaTimeoutRef.current) {
      clearTimeout(captchaTimeoutRef.current);
    }

    captchaTimeoutRef.current = setTimeout(() => {
      captchaTimeoutRef.current = null;
      // Fail-open: капча не успела ответить — отправляем без токена, сервер примет и пометит заявку.
      void sendLead("");
    }, CAPTCHA_FAILOPEN_TIMEOUT_MS);
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

  const modal = isOpen ? (
    <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <button className={styles.backdrop} type="button" aria-label="Закрыть форму" onClick={closeModal} />

          <div className={styles.panel}>
            <button className={styles.close} type="button" aria-label="Закрыть форму" onClick={closeModal}>
              ×
            </button>

            {submitState === "success" ? (
              <div style={{ textAlign: "center", padding: "16px 4px 8px" }}>
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    margin: "0 auto 18px",
                    borderRadius: "50%",
                    background: "#111",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 12.5 10 17.5 19 7" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h2 className={styles.title} id={titleId} style={{ marginBottom: "8px" }}>
                  Заявка отправлена
                </h2>
                <p className={styles.subtitle} style={{ margin: "0 0 22px" }}>
                  Спасибо! Мы свяжемся с вами в ближайшее время.
                </p>
                <button className={styles.submit} type="button" onClick={closeModal} style={{ width: "100%" }}>
                  Закрыть
                </button>
              </div>
            ) : (
            <>
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

              <input
                type="text"
                name="company"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{ position: "absolute", left: "-9999px", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
              />

              <div className={styles.captcha}>
                <InvisibleSmartCaptcha
                  key={captchaKey}
                  sitekey={CAPTCHA_SITE_KEY}
                  visible={captchaVisible}
                  onSuccess={(token) => {
                    captchaTokenRef.current = token;

                    if (captchaTimeoutRef.current) {
                      // Успели уложиться в таймаут ожидания — отправляем сразу этим токеном.
                      clearTimeout(captchaTimeoutRef.current);
                      captchaTimeoutRef.current = null;
                      captchaTokenRef.current = "";
                      void sendLead(token);
                    }
                    // Иначе таймаут уже сработал (fail-open отправка ушла) — токен просто
                    // остаётся в captchaTokenRef на случай следующей попытки отправки.
                  }}
                  onChallengeHidden={() => {
                    if (captchaTimeoutRef.current) {
                      // Пользователь закрыл челлендж, не дождавшись успеха, — отправляем без токена.
                      clearTimeout(captchaTimeoutRef.current);
                      captchaTimeoutRef.current = null;
                      void sendLead("");
                    }
                  }}
                />
              </div>

              <button className={styles.submit} type="submit" disabled={submitState === "submitting"}>
                {submitState === "submitting" ? "Отправляем" : "Отправить"}
              </button>

              <p style={{ fontSize: "12px", lineHeight: 1.45, opacity: 0.65, margin: "10px 0 0" }}>
                Нажимая «Отправить», вы соглашаетесь с{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>
                  политикой обработки персональных данных
                </a>
                .
              </p>

              {message ? (
                <p className={`${styles.message} ${styles.messageError}`}>
                  {message}
                </p>
              ) : null}
            </form>
            </>
            )}
          </div>
    </div>
  ) : null;

  return (
    <section className={`${styles.section} ${placementClass}`} aria-labelledby={titleId}>
      <button className={openButtonClass} type="button" onClick={openModal}>
        Оставить заявку
      </button>

      {modal ? createPortal(modal, document.body) : null}
    </section>
  );
}
