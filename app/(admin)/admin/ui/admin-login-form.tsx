"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReCAPTCHA from "react-google-recaptcha";
import styles from "./admin.module.css";

const LOGIN_ERROR_DEFAULT = "Не удалось войти. Проверьте данные и попробуйте снова.";

export function AdminLoginForm() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string>("");
  const recaptchaRef = useRef<ReCAPTCHA | null>(null);
  // Captcha disabled
  const siteKey = "";

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (submitting) return;
      setStatus("");

       if (siteKey && !recaptchaToken) {
        setStatus("Подтвердите, что вы не робот");
        return;
      }

      setSubmitting(true);

      try {
        const response = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ login, password, recaptchaToken }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          setStatus(typeof payload.error === "string" ? payload.error : LOGIN_ERROR_DEFAULT);
          setSubmitting(false);
          if (siteKey) {
            recaptchaRef.current?.reset();
            setRecaptchaToken("");
          }
          return;
        }

        setStatus("Успешный вход. Перенаправляем...");
        router.push("/admin");
        setSubmitting(false);
        return;
      } catch (error) {
        console.error("admin login failed", error);
        setStatus(LOGIN_ERROR_DEFAULT);
        setSubmitting(false);
        return;
      }
    },
    [login, password, recaptchaToken, router, siteKey, submitting],
  );

  return (
    <main className={styles.loginMain}>
      <form className={styles.loginCard} onSubmit={handleSubmit}>
        <h1 className={styles.loginTitle}>Вход в систему</h1>
        <p className={styles.loginSubtitle}>Введите логин и пароль, выданные администрацией.</p>

        <label className={styles.inputGroup}>
          <span className={styles.inputLabel}>Логин</span>
          <input
            className={styles.textInput}
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            placeholder="example@rinart.pro"
            autoComplete="username"
            required
          />
        </label>

        <label className={styles.inputGroup}>
          <span className={styles.inputLabel}>Пароль</span>
          <input
            className={styles.textInput}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Введите пароль"
            autoComplete="current-password"
            required
          />
        </label>

        {/* captcha disabled */}

        <button className={styles.loginButton} type="submit" disabled={submitting}>
          {submitting ? "Авторизация…" : "Войти в систему"}
        </button>
        {/* captcha disabled */}
        <p className={styles.loginMeta}>Все попытки авторизации фиксируются в журнале безопасности.</p>
        {status ? <span className={styles.statusBar}>{status}</span> : null}
      </form>
    </main>
  );
}
