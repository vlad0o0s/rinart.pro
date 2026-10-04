"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { SmartCaptcha } from "@yandex/smart-captcha";
import { SMARTCAPTCHA_SITE_KEY } from "@/lib/smart-captcha-site-key";
import styles from "./admin.module.css";

const LOGIN_ERROR_DEFAULT = "Не удалось войти. Проверьте данные и попробуйте снова.";
const CAPTCHA_REQUIRED = "Подтвердите, что вы не робот";
const CAPTCHA_LOAD_ERROR = "Проверка «Я не робот» не загрузилась. Обновите страницу и попробуйте снова.";

export function AdminLoginForm() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string>("");
  // Токен капчи одноразовый: после неудачной попытки виджет создаётся заново —
  // у компонента SmartCaptcha нет сброса, его заменяет смена key.
  const [captchaNonce, setCaptchaNonce] = useState(0);

  const resetCaptcha = useCallback(() => {
    setCaptchaToken("");
    setCaptchaNonce((value) => value + 1);
  }, []);

  const handleCaptchaError = useCallback(() => {
    setCaptchaToken("");
    setStatus(CAPTCHA_LOAD_ERROR);
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (submitting) return;
      setStatus("");

      if (!captchaToken) {
        setStatus(CAPTCHA_REQUIRED);
        return;
      }

      setSubmitting(true);

      try {
        const response = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ login, password, captchaToken }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          setStatus(typeof payload.error === "string" ? payload.error : LOGIN_ERROR_DEFAULT);
          setSubmitting(false);
          resetCaptcha();
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
        resetCaptcha();
        return;
      }
    },
    [login, password, router, submitting, captchaToken, resetCaptcha],
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

        <div className={styles.captchaWrapper}>
          <SmartCaptcha
            key={captchaNonce}
            sitekey={SMARTCAPTCHA_SITE_KEY}
            language="ru"
            onSuccess={setCaptchaToken}
            onTokenExpired={resetCaptcha}
            onNetworkError={handleCaptchaError}
            onJavascriptError={handleCaptchaError}
          />
        </div>

        <button className={styles.loginButton} type="submit" disabled={submitting}>
          {submitting ? "Авторизация…" : "Войти в систему"}
        </button>
        <p className={styles.loginMeta}>Все попытки авторизации фиксируются в журнале безопасности.</p>
        {status ? <span className={styles.statusBar}>{status}</span> : null}
      </form>
    </main>
  );
}
