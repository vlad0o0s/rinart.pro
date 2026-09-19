"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./leads-panel.module.css";

/**
 * Счётчик заявок: сколько заявок с форм пришло по месяцам и из каких источников.
 * Звонки и переходы в мессенджеры сайт не видит — они остаются в целях Метрики.
 */

type LeadSource = { id: string; label: string };

type LeadRow = {
  key: string;
  createdAt: string;
  form: string;
  name: string;
  phone: string;
  sourceId: string;
  landingPage: string | null;
  pageUrl: string | null;
  referrer: string | null;
  campaign: string | null;
  hasQuiz: boolean;
  unverified: boolean;
  isTest: boolean;
};

type MonthRow = { month: string; total: number; bySource: Record<string, number> };

type LeadsResponse = {
  sources: LeadSource[];
  summary: { months: MonthRow[]; testCount: number };
  leads: LeadRow[];
};

/** Поиск Яндекса показываем всегда, даже с нулём: ради него счётчик и заведён. */
const ALWAYS_VISIBLE_SOURCE = "yandex";

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const monthFormat = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" });

function formatMonth(key: string) {
  const date = new Date(`${key}-01T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? key : monthFormat.format(date);
}

function formatDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : dateFormat.format(date);
}

function pathOf(url: string | null) {
  if (!url) {
    return null;
  }
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export function LeadsPanel() {
  const [data, setData] = useState<LeadsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/leads", { credentials: "include", cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      if (!response.ok) {
        throw new Error(`Ответ сервера: ${response.status}`);
      }
      setData((await response.json()) as LeadsResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить заявки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleTest = useCallback(
    async (lead: LeadRow) => {
      setSavingKey(lead.key);
      setError(null);
      try {
        const response = await fetch("/api/admin/leads", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: lead.key, isTest: !lead.isTest }),
        });
        if (response.status === 401) {
          window.location.href = "/admin/login";
          return;
        }
        if (!response.ok) {
          throw new Error(`Ответ сервера: ${response.status}`);
        }
        // Итоги считает сервер, поэтому после отметки перечитываем всё целиком.
        await load();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить отметку");
      } finally {
        setSavingKey(null);
      }
    },
    [load],
  );

  const sourceLabels = useMemo(() => new Map((data?.sources ?? []).map((source) => [source.id, source.label])), [data]);

  const visibleSources = useMemo(() => {
    if (!data) {
      return [];
    }
    return data.sources.filter(
      (source) => source.id === ALWAYS_VISIBLE_SOURCE || data.summary.months.some((row) => (row.bySource[source.id] ?? 0) > 0),
    );
  }, [data]);

  return (
    <section className={styles.panel} aria-busy={loading}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Заявки</p>
          <h2 className={styles.title}>Заявки с форм сайта</h2>
          <p className={styles.subtitle}>
            Считаются только заявки с форм. Звонки и переходы в мессенджеры сайт не видит — они остаются в целях Метрики.
          </p>
        </div>
        <button className={styles.refresh} type="button" onClick={() => void load()} disabled={loading}>
          {loading ? "Загружаем..." : "Обновить"}
        </button>
      </header>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>По месяцам и источникам</h3>
            {data.summary.months.length ? (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Месяц</th>
                      <th scope="col" className={styles.num}>
                        Всего
                      </th>
                      {visibleSources.map((source) => (
                        <th key={source.id} scope="col" className={styles.num}>
                          {source.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.summary.months.map((row) => (
                      <tr key={row.month}>
                        <th scope="row">{formatMonth(row.month)}</th>
                        <td className={styles.num}>{row.total}</td>
                        {visibleSources.map((source) => (
                          <td key={source.id} className={styles.num}>
                            {row.bySource[source.id] || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.empty}>Заявок пока нет.</p>
            )}
            <p className={styles.note}>
              Проверочные заявки в итоги не входят{data.summary.testCount ? ` — сейчас их ${data.summary.testCount}` : ""}. Источник
              определяется по меткам ссылки и адресу, с которого человек пришёл. Переход с Яндекс Карт без меток браузер
              показывает как переход с Яндекса, поэтому он попадает в «Яндекс: поиск». Месяцы — по московскому времени; файл
              хранит последние 500 заявок.
            </p>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Последние заявки</h3>
            {data.leads.length ? (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Дата, МСК</th>
                      <th scope="col">Источник</th>
                      <th scope="col">Страница входа</th>
                      <th scope="col">Форма</th>
                      <th scope="col">Имя</th>
                      <th scope="col">Телефон</th>
                      <th scope="col">Тест</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.leads.map((lead) => (
                      <tr key={lead.key} data-test={lead.isTest}>
                        <td className={styles.nowrap}>{formatDate(lead.createdAt)}</td>
                        <td>
                          {sourceLabels.get(lead.sourceId) ?? lead.sourceId}
                          {lead.campaign ? <span className={styles.meta}>кампания: {lead.campaign}</span> : null}
                          {lead.referrer ? <span className={styles.meta}>{lead.referrer}</span> : null}
                        </td>
                        <td>{lead.landingPage ?? <span className={styles.meta}>не записана</span>}</td>
                        <td>
                          {lead.form}
                          {pathOf(lead.pageUrl) ? <span className={styles.meta}>{pathOf(lead.pageUrl)}</span> : null}
                          {lead.hasQuiz ? <span className={styles.meta}>с ответами квиза</span> : null}
                          {lead.unverified ? <span className={styles.warn}>капча не подтверждена</span> : null}
                        </td>
                        <td>{lead.name || "—"}</td>
                        <td className={styles.nowrap}>{lead.phone}</td>
                        <td>
                          <label className={styles.testToggle}>
                            <input
                              type="checkbox"
                              checked={lead.isTest}
                              disabled={savingKey === lead.key}
                              onChange={() => void toggleTest(lead)}
                            />
                            <span className={styles.srOnly}>Проверочная заявка от {formatDate(lead.createdAt)}</span>
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.empty}>Заявок пока нет.</p>
            )}
          </div>
        </>
      ) : loading ? (
        <p className={styles.empty}>Загружаем заявки...</p>
      ) : null}
    </section>
  );
}
