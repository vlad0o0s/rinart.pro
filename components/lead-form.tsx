"use client";

import { SmartCaptcha } from "@yandex/smart-captcha";
import { FormEvent, useId, useMemo, useState } from "react";
import styles from "./lead-form.module.css";

const CAPTCHA_SITE_KEY = "ysc1_kSspdc4CreezvRnhYrKOF8CfF79arnKlhequLaHL7fe55cea";

type LeadFormProps = {
  source: string;
  title?: string;
  subtitle?: string;
};

type SubmitState = "idle" | "submitting" | "success" | "error";

export function LeadForm({
  source,
  title = "Напишите нам",
  subtitle = "Оставьте имя и телефон, мы свяжемся с вами и ответим на вопросы.",
}: LeadFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaNonce, setCaptchaNonce] = useState(0);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");
  const titleId = useId();
  const captchaKey = useMemo(() => `${source}-${captchaNonce}`, [source, captchaNonce]);

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
    } catch (error) {
      setCaptchaToken("");
      setCaptchaNonce((value) => value + 1);
      setSubmitState("error");
      setMessage(error instanceof Error ? error.message : "Не удалось отправить заявку.");
    }
  }

  return (
    <section className={styles.section} aria-labelledby={titleId}>
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
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Телефон"
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
    </section>
  );
}
