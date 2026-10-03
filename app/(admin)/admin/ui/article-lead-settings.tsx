"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ARTICLE_LEAD_HASH,
  ARTICLE_LEAD_MODAL_DEFAULTS,
  ARTICLE_LEAD_MODAL_LIMITS,
  AUTO_OPEN_MIN_SECONDS,
  type ArticleLeadModalSettings,
} from "@/lib/article-lead-modal";
import styles from "./articles-panel.module.css";

/**
 * Настройки окна заявки — общие для всех статей: показывать ли окно и блок в тексте
 * и что в них написано. Пустое поле при сохранении возвращается к тексту по умолчанию.
 */

const ENDPOINT = "/api/admin/settings/article-lead-modal";

type TextField = "title" | "text" | "submitLabel" | "inlineText" | "inlineButton";

export function ArticleLeadSettings() {
  const [settings, setSettings] = useState<ArticleLeadModalSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const request = useCallback(async (init?: RequestInit) => {
    const response = await fetch(ENDPOINT, { credentials: "include", cache: "no-store", ...init });
    if (response.status === 401) {
      window.location.href = "/admin/login";
      return null;
    }
    const payload = (await response.json().catch(() => null)) as { settings?: ArticleLeadModalSettings; error?: string } | null;
    if (!response.ok || !payload?.settings) {
      throw new Error(payload?.error || `Ответ сервера: ${response.status}`);
    }
    return payload.settings;
  }, []);

  useEffect(() => {
    let cancelled = false;
    request()
      .then((loaded) => {
        if (!cancelled && loaded) {
          setSettings(loaded);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Не удалось загрузить настройки окна");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [request]);

  const change = useCallback((patch: Partial<ArticleLeadModalSettings>) => {
    setSettings((current) => (current ? { ...current, ...patch } : current));
    setDirty(true);
    setNotice(null);
  }, []);

  const save = useCallback(async () => {
    if (!settings) {
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await request({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      if (saved) {
        setSettings(saved);
        setDirty(false);
        setNotice("Сохранено: настройки уже действуют во всех статьях");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить настройки окна");
    } finally {
      setSaving(false);
    }
  }, [request, settings]);

  const textField = (field: TextField, label: string, hint?: string, rows?: number) => {
    if (!settings) {
      return null;
    }
    const common = {
      value: settings[field],
      maxLength: ARTICLE_LEAD_MODAL_LIMITS[field],
      placeholder: ARTICLE_LEAD_MODAL_DEFAULTS[field],
    };
    return (
      <label className={styles.field}>
        <span>{label}</span>
        {rows ? (
          <textarea {...common} rows={rows} onChange={(event) => change({ [field]: event.target.value })} />
        ) : (
          <input {...common} onChange={(event) => change({ [field]: event.target.value })} />
        )}
        {hint ? <small>{hint}</small> : null}
      </label>
    );
  };

  const summary = settings
    ? [settings.autoOpen ? "окно открывается само" : "окно само не открывается", settings.inlineCta ? "блок в тексте включён" : "блок в тексте выключен"].join(", ")
    : "загружаем…";

  return (
    <details className={styles.settings}>
      <summary>
        Окно заявки в статьях <span className={styles.muted}>— {summary}</span>
      </summary>

      {settings ? (
        <form
          className={styles.settingsBody}
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <p className={styles.muted}>
            Читателю статьи заявку предлагают в трёх местах: блок в середине текста, окно при чтении и форма под статьёй.
            Настройки общие для всех статей.
          </p>

          <label className={styles.check}>
            <input type="checkbox" checked={settings.autoOpen} onChange={(event) => change({ autoOpen: event.target.checked })} />
            Открывать окно само, когда читатель прошёл больше половины статьи
          </label>
          <p className={styles.muted}>
            Не раньше чем через {AUTO_OPEN_MIN_SECONDS} секунд на странице и один раз за визит. Кто закрыл окно — неделю его не видит,
            кто оставил заявку — три месяца.
          </p>

          <div className={styles.grid2}>
            {textField("title", "Заголовок окна")}
            {textField("submitLabel", "Надпись на кнопке окна")}
          </div>
          {textField("text", "Текст окна", "Одно-два предложения: что произойдёт после того, как человек оставит телефон.", 3)}

          <label className={styles.check}>
            <input type="checkbox" checked={settings.inlineCta} onChange={(event) => change({ inlineCta: event.target.checked })} />
            Показывать блок с кнопкой в середине длинной статьи
          </label>
          <p className={styles.muted}>
            Блок встаёт перед подзаголовком, ближайшим к середине текста. В статье короче 2500 знаков или без подзаголовков его не будет.
          </p>

          {textField("inlineText", "Текст блока", undefined, 3)}
          {textField("inlineButton", "Надпись на кнопке блока")}

          <p className={styles.muted}>
            Окно можно открыть и из текста: сделайте ссылку с адресом <code>{ARTICLE_LEAD_HASH}</code>. Чтобы посмотреть окно,
            откройте статью и добавьте <code>{ARTICLE_LEAD_HASH}</code> в конец адреса.
          </p>

          {error ? (
            <p className={styles.errors} role="alert">
              {error}
            </p>
          ) : null}
          {notice ? <p className={styles.notice}>{notice}</p> : null}

          <div className={styles.actions}>
            <button className={styles.primary} type="submit" disabled={saving || !dirty}>
              {saving ? "Сохраняем…" : "Сохранить"}
            </button>
            <button
              className={styles.secondary}
              type="button"
              disabled={saving}
              onClick={() =>
                change({
                  title: ARTICLE_LEAD_MODAL_DEFAULTS.title,
                  text: ARTICLE_LEAD_MODAL_DEFAULTS.text,
                  submitLabel: ARTICLE_LEAD_MODAL_DEFAULTS.submitLabel,
                  inlineText: ARTICLE_LEAD_MODAL_DEFAULTS.inlineText,
                  inlineButton: ARTICLE_LEAD_MODAL_DEFAULTS.inlineButton,
                })
              }
            >
              Вернуть тексты по умолчанию
            </button>
          </div>
        </form>
      ) : error ? (
        <p className={styles.errors} role="alert">
          {error}
        </p>
      ) : null}
    </details>
  );
}
