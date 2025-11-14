"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import styles from "./admin.module.css";

const ReCAPTCHA = dynamic(() => import("react-google-recaptcha"), { ssr: false });
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

const LOGIN_ERROR_DEFAULT = "Не удалось войти. Проверьте данные и попробуйте снова.";

export function AdminLoginForm() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const recaptchaRef = useRef<import("react-google-recaptcha").ReCAPTCHA | null>(null);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (submitting) return;
      setStatus("");
      setSubmitting(true);

      try {
        let recaptchaToken: string | undefined;
        if (RECAPTCHA_SITE_KEY) {
          recaptchaToken = await recaptchaRef.current?.executeAsync();
          recaptchaRef.current?.reset();
        }

        const response = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ login, password, recaptchaToken }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          setStatus(typeof payload.error === "string" ? payload.error : LOGIN_ERROR_DEFAULT);
          setSubmitting(false);
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
    [login, password, router, submitting],
  );

  return (
    <div className={styles.loginShell}>
      <SiteHeader showDesktopNav={false} showDesktopBrand showMobileBrand={false} />

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

          <button className={styles.loginButton} type="submit" disabled={submitting}>
            {submitting ? "Авторизация…" : "Войти в систему"}
          </button>
          {RECAPTCHA_SITE_KEY ? (
            <ReCAPTCHA ref={recaptchaRef} sitekey={RECAPTCHA_SITE_KEY} size="invisible" />
          ) : (
            <p className={styles.statusBar}>
              reCAPTCHA не настроена. Добавьте ключи в переменные окружения.
            </p>
          )}
          <p className={styles.loginMeta}>Все попытки авторизации фиксируются в журнале безопасности.</p>
          {status ? <span className={styles.statusBar}>{status}</span> : null}
        </form>
      </main>

      <Footer />
    </div>
  );
}
