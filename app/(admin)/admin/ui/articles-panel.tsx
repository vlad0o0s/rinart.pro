"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ClipboardEvent, DragEvent, MouseEvent as ReactMouseEvent } from "react";
import { ARTICLES_PATH, slugifyTitle, type Article } from "@/lib/articles";
import { AdminAuthError, askImageAlt, escapeHtmlText, inlineImageHtml, uploadInlineImage } from "./admin-media";
import styles from "./articles-panel.module.css";

/**
 * Раздел «Статьи» в админке. Статьи пишет и публикует бюро: здесь редактор текста,
 * обложка, автор, даты, связанные услуга и проекты и поля для поиска.
 * Раздел и пункт меню появляются на сайте после публикации первой статьи.
 */

type ServiceOption = { path: string; label: string };
type ProjectOption = { slug: string; title: string };
type ArticlesResponse = { articles: Article[]; services: ServiceOption[]; projects: ProjectOption[] };

type FormState = {
  id: number | null;
  title: string;
  slug: string;
  slugTouched: boolean;
  status: "draft" | "published";
  excerpt: string;
  bodyHtml: string;
  coverImageUrl: string;
  authorName: string;
  authorRole: string;
  /** Дата в поле формы (YYYY-MM-DD) и исходное значение — чтобы не сдвигать время при каждом сохранении. */
  publishedDate: string;
  publishedAtIso: string | null;
  updatedDate: string;
  contentUpdatedAtIso: string | null;
  seoTitle: string;
  seoDescription: string;
  servicePath: string;
  relatedProjects: string[];
};

const EMPTY_FORM: FormState = {
  id: null,
  title: "",
  slug: "",
  slugTouched: false,
  status: "draft",
  excerpt: "",
  bodyHtml: "",
  coverImageUrl: "",
  authorName: "",
  authorRole: "",
  publishedDate: "",
  publishedAtIso: null,
  updatedDate: "",
  contentUpdatedAtIso: null,
  seoTitle: "",
  seoDescription: "",
  servicePath: "",
  relatedProjects: [],
};

const MAX_RELATED_PROJECTS = 6;

const moscowDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" });
const listDate = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "numeric", month: "short", year: "numeric" });

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : moscowDate.format(date);
}

function todayInput(): string {
  return moscowDate.format(new Date());
}

function formFromArticle(article: Article): FormState {
  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    slugTouched: true,
    status: article.status,
    excerpt: article.excerpt,
    bodyHtml: article.bodyHtml,
    coverImageUrl: article.coverImageUrl ?? "",
    authorName: article.authorName,
    authorRole: article.authorRole,
    publishedDate: toDateInput(article.publishedAt),
    publishedAtIso: article.publishedAt,
    updatedDate: toDateInput(article.contentUpdatedAt),
    contentUpdatedAtIso: article.contentUpdatedAt,
    seoTitle: article.seoTitle,
    seoDescription: article.seoDescription,
    servicePath: article.servicePath ?? "",
    relatedProjects: article.relatedProjects,
  };
}

function payloadFromForm(form: FormState) {
  // Неизменённая дата уходит как была — со временем, а не полночью выбранного дня.
  const publishedAt =
    form.publishedAtIso && form.publishedDate === toDateInput(form.publishedAtIso) ? form.publishedAtIso : form.publishedDate || null;
  const contentUpdatedAt =
    form.contentUpdatedAtIso && form.updatedDate === toDateInput(form.contentUpdatedAtIso)
      ? form.contentUpdatedAtIso
      : form.updatedDate || null;
  return {
    title: form.title,
    slug: form.slug,
    status: form.status,
    excerpt: form.excerpt,
    bodyHtml: form.bodyHtml,
    coverImageUrl: form.coverImageUrl || null,
    authorName: form.authorName,
    authorRole: form.authorRole,
    publishedAt,
    contentUpdatedAt,
    seoTitle: form.seoTitle,
    seoDescription: form.seoDescription,
    servicePath: form.servicePath || null,
    relatedProjects: form.relatedProjects,
  };
}

function plainLength(html: string): number {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().length;
}

export function ArticlesPanel() {
  const [data, setData] = useState<ArticlesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const handleAuthError = useCallback((error: unknown) => {
    if (error instanceof AdminAuthError) {
      window.location.href = "/admin/login";
      return true;
    }
    return false;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/articles", { credentials: "include", cache: "no-store" });
      if (response.status === 401) {
        throw new AdminAuthError();
      }
      if (!response.ok) {
        throw new Error(`Ответ сервера: ${response.status}`);
      }
      setData((await response.json()) as ArticlesResponse);
    } catch (error) {
      if (!handleAuthError(error)) {
        setErrors([error instanceof Error ? error.message : "Не удалось загрузить статьи"]);
      }
    } finally {
      setLoading(false);
    }
  }, [handleAuthError]);

  useEffect(() => {
    void load();
  }, [load]);

  // Несохранённые правки не должны пропадать при закрытии вкладки.
  useEffect(() => {
    if (!dirty) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const confirmDiscard = useCallback(() => !dirty || window.confirm("Есть несохранённые правки. Закрыть статью без сохранения?"), [dirty]);

  const openArticle = useCallback(
    (article: Article | null) => {
      if (!confirmDiscard()) {
        return;
      }
      setForm(article ? formFromArticle(article) : { ...EMPTY_FORM });
      setDirty(false);
      setErrors([]);
      setNotice(null);
    },
    [confirmDiscard],
  );

  const update = useCallback(<K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [field]: value };
      // Адрес строится из заголовка, пока его не поправили руками.
      if (field === "title" && !prev.slugTouched) {
        next.slug = slugifyTitle(String(value));
      }
      if (field === "slug") {
        next.slugTouched = true;
      }
      return next;
    });
    setDirty(true);
    setNotice(null);
  }, []);

  const save = useCallback(
    async (statusOverride?: "draft" | "published") => {
      if (!form) return;
      const payload = payloadFromForm(statusOverride ? { ...form, status: statusOverride } : form);
      setSaving(true);
      setErrors([]);
      setNotice(null);
      try {
        const response = await fetch(form.id ? `/api/admin/articles/${form.id}` : "/api/admin/articles", {
          method: form.id ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (response.status === 401) {
          throw new AdminAuthError();
        }
        const result = (await response.json().catch(() => null)) as { article?: Article; errors?: string[] } | null;
        if (!response.ok || !result?.article) {
          setErrors(result?.errors?.length ? result.errors : [`Не удалось сохранить (${response.status})`]);
          return;
        }
        setForm(formFromArticle(result.article));
        setDirty(false);
        setNotice(result.article.status === "published" ? "Сохранено, статья на сайте" : "Черновик сохранён");
        await load();
      } catch (error) {
        if (!handleAuthError(error)) {
          setErrors([error instanceof Error ? error.message : "Не удалось сохранить статью"]);
        }
      } finally {
        setSaving(false);
      }
    },
    [form, handleAuthError, load],
  );

  const remove = useCallback(async () => {
    if (!form?.id || !window.confirm(`Удалить статью «${form.title}»? Это действие нельзя отменить.`)) {
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/articles/${form.id}`, { method: "DELETE", credentials: "include" });
      if (response.status === 401) {
        throw new AdminAuthError();
      }
      if (!response.ok) {
        throw new Error(`Не удалось удалить (${response.status})`);
      }
      setForm(null);
      setDirty(false);
      await load();
    } catch (error) {
      if (!handleAuthError(error)) {
        setErrors([error instanceof Error ? error.message : "Не удалось удалить статью"]);
      }
    } finally {
      setSaving(false);
    }
  }, [form, handleAuthError, load]);

  const uploadCover = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !file.type.startsWith("image/")) {
        return;
      }
      setCoverUploading(true);
      try {
        const uploaded = await uploadInlineImage(file);
        update("coverImageUrl", uploaded.url);
      } catch (error) {
        if (!handleAuthError(error)) {
          window.alert(error instanceof Error ? error.message : "Не удалось загрузить обложку");
        }
      } finally {
        setCoverUploading(false);
      }
    },
    [handleAuthError, update],
  );

  const checklist = useMemo(() => {
    if (!form) return [];
    const related = form.relatedProjects.length;
    return [
      { ok: Boolean(form.authorName.trim()), label: "Автор — архитектор, который писал или проверял текст" },
      { ok: plainLength(form.bodyHtml) >= 1500, label: "Текст не короче 1500 знаков, с подзаголовками" },
      { ok: /<img\b/i.test(form.bodyHtml) || Boolean(form.coverImageUrl), label: "Свои иллюстрации: обложка или картинки в тексте" },
      { ok: Boolean(form.servicePath), label: "Связанная услуга — статья ведёт читателя к ней" },
      { ok: related >= 2 && related <= 3, label: "2–3 связанных проекта" },
      { ok: Boolean(form.excerpt.trim() || form.seoDescription.trim()), label: "Вступление или описание для поиска" },
    ];
  }, [form]);

  const articles = data?.articles ?? [];
  const publishedCount = articles.filter((article) => article.status === "published").length;

  return (
    <section className={styles.panel} aria-busy={loading || saving}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Статьи</p>
          <h2 className={styles.title}>Статьи на сайте</h2>
          <p className={styles.subtitle}>
            {publishedCount
              ? `Опубликовано: ${publishedCount}. Раздел ${ARTICLES_PATH} и пункт меню «Статьи» видны на сайте.`
              : `Раздел ${ARTICLES_PATH} и пункт меню «Статьи» появятся на сайте после публикации первой статьи.`}
          </p>
        </div>
        <button className={styles.primary} type="button" onClick={() => openArticle(null)} disabled={saving}>
          Новая статья
        </button>
      </header>

      <div className={styles.layout}>
        <nav className={styles.list} aria-label="Список статей">
          {loading && !data ? <p className={styles.muted}>Загружаем…</p> : null}
          {data && !articles.length ? <p className={styles.muted}>Статей пока нет.</p> : null}
          <ul>
            {articles.map((article) => (
              <li key={article.id}>
                <button
                  type="button"
                  className={styles.listItem}
                  data-active={form?.id === article.id}
                  onClick={() => openArticle(article)}
                >
                  <span className={styles.listTitle}>{article.title || "Без заголовка"}</span>
                  <span className={styles.listMeta}>
                    <span className={styles.badge} data-status={article.status}>
                      {article.status === "published" ? "На сайте" : "Черновик"}
                    </span>
                    {article.publishedAt ? listDate.format(new Date(article.publishedAt)) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {form ? (
          <form
            className={styles.editor}
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            {errors.length ? (
              <ul className={styles.errors} role="alert">
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            ) : null}
            {notice ? <p className={styles.notice}>{notice}</p> : null}

            <label className={styles.field}>
              <span>Заголовок</span>
              <input value={form.title} onChange={(event) => update("title", event.target.value)} required maxLength={200} />
            </label>

            <label className={styles.field}>
              <span>Адрес статьи</span>
              <div className={styles.slugRow}>
                <span className={styles.muted}>{ARTICLES_PATH}/</span>
                <input value={form.slug} onChange={(event) => update("slug", event.target.value.toLowerCase())} pattern="[a-z0-9]+(-[a-z0-9]+)*" />
              </div>
              <small>Латиница, цифры и дефисы. После публикации адрес лучше не менять.</small>
            </label>

            <label className={styles.field}>
              <span>Вступление</span>
              <textarea value={form.excerpt} onChange={(event) => update("excerpt", event.target.value)} rows={3} maxLength={400} />
              <small>Два-три предложения: о чём статья и кому она поможет. Показывается в списке и над текстом.</small>
            </label>

            <div className={styles.field}>
              <span>Обложка</span>
              <div className={styles.coverRow}>
                {form.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.coverImageUrl} alt="" className={styles.coverPreview} />
                ) : (
                  <span className={styles.muted}>Не выбрана</span>
                )}
                <button type="button" className={styles.secondary} onClick={() => coverInputRef.current?.click()} disabled={coverUploading}>
                  {coverUploading ? "Загружаем…" : form.coverImageUrl ? "Заменить" : "Загрузить"}
                </button>
                {form.coverImageUrl ? (
                  <button type="button" className={styles.secondary} onClick={() => update("coverImageUrl", "")}>
                    Убрать
                  </button>
                ) : null}
                <input ref={coverInputRef} type="file" accept="image/*" hidden onChange={uploadCover} />
              </div>
            </div>

            <div className={styles.field}>
              <span>Текст</span>
              <ArticleBodyEditor
                key={form.id ?? "new"}
                html={form.bodyHtml}
                defaultAlt={form.title}
                onChange={(html) => update("bodyHtml", html)}
                onAuthError={handleAuthError}
              />
              <small>
                Подзаголовки — кнопками H2 и H3. Картинки — кнопкой IMG, подпись к картинке правится двойным щелчком. Текст из
                Word и Google Docs вставляется без оформления.
              </small>
            </div>

            <div className={styles.grid2}>
              <label className={styles.field}>
                <span>Автор</span>
                <input value={form.authorName} onChange={(event) => update("authorName", event.target.value)} placeholder="Имя и фамилия" />
              </label>
              <label className={styles.field}>
                <span>Должность автора</span>
                <input value={form.authorRole} onChange={(event) => update("authorRole", event.target.value)} placeholder="Например, архитектор" />
              </label>
            </div>

            <div className={styles.grid2}>
              <label className={styles.field}>
                <span>Дата публикации</span>
                <input type="date" value={form.publishedDate} onChange={(event) => update("publishedDate", event.target.value)} />
                <small>Пусто — дата поставится при публикации.</small>
              </label>
              <label className={styles.field}>
                <span>Дата существенного обновления</span>
                <div className={styles.slugRow}>
                  <input type="date" value={form.updatedDate} onChange={(event) => update("updatedDate", event.target.value)} />
                  <button type="button" className={styles.secondary} onClick={() => update("updatedDate", todayInput())}>
                    Сегодня
                  </button>
                </div>
                <small>Ставьте, только когда текст заметно дополнили, а не при исправлении опечатки.</small>
              </label>
            </div>

            <div className={styles.grid2}>
              <label className={styles.field}>
                <span>Связанная услуга</span>
                <select value={form.servicePath} onChange={(event) => update("servicePath", event.target.value)}>
                  <option value="">— не выбрана —</option>
                  {(data?.services ?? []).map((service) => (
                    <option key={service.path} value={service.path}>
                      {service.label}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className={styles.field}>
                <legend>Связанные проекты (до {MAX_RELATED_PROJECTS})</legend>
                <div className={styles.projects}>
                  {(data?.projects ?? []).map((project) => {
                    const checked = form.relatedProjects.includes(project.slug);
                    return (
                      <label key={project.slug} className={styles.check}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!checked && form.relatedProjects.length >= MAX_RELATED_PROJECTS}
                          onChange={() =>
                            update(
                              "relatedProjects",
                              checked ? form.relatedProjects.filter((slug) => slug !== project.slug) : [...form.relatedProjects, project.slug],
                            )
                          }
                        />
                        {project.title}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            <label className={styles.field}>
              <span>Заголовок для поиска (title) — {form.seoTitle.length} знаков</span>
              <input value={form.seoTitle} onChange={(event) => update("seoTitle", event.target.value)} maxLength={200} placeholder={form.title ? `${form.title} — RINART` : ""} />
              <small>До 70 знаков. Пусто — возьмём заголовок статьи.</small>
            </label>

            <label className={styles.field}>
              <span>Описание для поиска (description) — {form.seoDescription.length} знаков</span>
              <textarea value={form.seoDescription} onChange={(event) => update("seoDescription", event.target.value)} rows={2} maxLength={300} />
              <small>120–160 знаков: что человек узнает из статьи. Пусто — возьмём вступление.</small>
            </label>

            <div className={styles.checklist}>
              <p>Перед публикацией</p>
              <ul>
                {checklist.map((item) => (
                  <li key={item.label} data-ok={item.ok}>
                    {item.ok ? "✓" : "○"} {item.label}
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.actions}>
              <button type="submit" className={styles.secondary} disabled={saving}>
                {saving ? "Сохраняем…" : form.status === "published" ? "Сохранить" : "Сохранить черновик"}
              </button>
              {form.status === "draft" ? (
                <button type="button" className={styles.primary} disabled={saving} onClick={() => void save("published")}>
                  Опубликовать
                </button>
              ) : (
                <button type="button" className={styles.secondary} disabled={saving} onClick={() => void save("draft")}>
                  Снять с публикации
                </button>
              )}
              {form.id ? (
                <a className={styles.secondary} href={`${ARTICLES_PATH}/${form.slug}`} target="_blank" rel="noreferrer">
                  {form.status === "published" ? "Открыть на сайте" : "Предпросмотр"}
                </a>
              ) : null}
              {form.id ? (
                <button type="button" className={styles.danger} disabled={saving} onClick={() => void remove()}>
                  Удалить
                </button>
              ) : null}
            </div>
          </form>
        ) : (
          <div className={styles.placeholder}>
            <p>Выберите статью слева или создайте новую.</p>
          </div>
        )}
      </div>
    </section>
  );
}

type EditorProps = {
  html: string;
  defaultAlt: string;
  onChange: (html: string) => void;
  onAuthError: (error: unknown) => boolean;
};

/** Редактор текста статьи: оформление только кнопками, вставка — чистым текстом. */
function ArticleBodyEditor({ html, defaultAlt, onChange, onAuthError }: EditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.innerHTML !== html) {
      editor.innerHTML = html;
    }
  }, [html]);

  const sync = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const saveSelection = useCallback((): Range | null => {
    const selection = window.getSelection();
    const editor = editorRef.current;
    if (!selection || !selection.rangeCount || !editor) return null;
    const range = selection.getRangeAt(0);
    return editor.contains(range.commonAncestorContainer) ? range.cloneRange() : null;
  }, []);

  const restoreSelection = useCallback((range: Range | null) => {
    editorRef.current?.focus();
    if (!range) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, []);

  const exec = useCallback(
    (command: string, value?: string) => {
      editorRef.current?.focus();
      document.execCommand(command, false, value);
      sync();
    },
    [sync],
  );

  const insertLink = useCallback(() => {
    const range = saveSelection();
    const url = window.prompt("Адрес ссылки. Для страниц сайта — без домена, например /proektirovanie", "/");
    if (!url || !url.trim()) return;
    const value = url.trim();
    if (!/^(\/|https?:\/\/|mailto:|tel:)/i.test(value)) {
      window.alert("Ссылка должна начинаться с «/», «https://», «mailto:» или «tel:»");
      return;
    }
    restoreSelection(range);
    document.execCommand("createLink", false, value);
    sync();
  }, [restoreSelection, saveSelection, sync]);

  const insertImageFile = useCallback(
    async (file: File, range: Range | null) => {
      const alt = askImageAlt(defaultAlt);
      if (!alt) return;
      setUploading(true);
      try {
        const uploaded = await uploadInlineImage(file);
        restoreSelection(range);
        document.execCommand("insertHTML", false, inlineImageHtml({ src: uploaded.url, alt, width: uploaded.width, height: uploaded.height }));
        sync();
      } catch (error) {
        if (!onAuthError(error)) {
          window.alert(error instanceof Error ? error.message : "Не удалось загрузить изображение");
        }
      } finally {
        setUploading(false);
      }
    },
    [defaultAlt, onAuthError, restoreSelection, sync],
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      event.preventDefault();
      const text = event.clipboardData?.getData("text/plain") ?? "";
      if (!text.trim()) return;
      // Абзацы из Word и Google Docs приходят через пустую строку — сохраняем их абзацами.
      const paragraphs = text.replace(/\r\n?/g, "\n").split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
      const htmlToInsert =
        paragraphs.length > 1
          ? paragraphs.map((part) => `<p>${escapeHtmlText(part).replace(/\n/g, "<br>")}</p>`).join("")
          : escapeHtmlText(paragraphs[0] ?? text).replace(/\n/g, "<br>");
      editorRef.current?.focus();
      document.execCommand("insertHTML", false, htmlToInsert);
      sync();
    },
    [sync],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      const file = event.dataTransfer.files?.[0];
      if (!file || !file.type.startsWith("image/")) {
        return;
      }
      event.preventDefault();
      const dropRange = document.caretRangeFromPoint?.(event.clientX, event.clientY) ?? null;
      const editor = editorRef.current;
      void insertImageFile(file, dropRange && editor && editor.contains(dropRange.startContainer) ? dropRange : saveSelection());
    },
    [insertImageFile, saveSelection],
  );

  const handleDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (!target || target.tagName !== "IMG") return;
      const alt = askImageAlt(target.getAttribute("alt") ?? "");
      if (alt) {
        target.setAttribute("alt", alt);
        sync();
      }
    },
    [sync],
  );

  const keepSelection = (event: ReactMouseEvent<HTMLButtonElement>) => event.preventDefault();

  const buttons: Array<{ label: string; title: string; run: () => void }> = [
    { label: "¶", title: "Обычный абзац", run: () => exec("formatBlock", "<p>") },
    { label: "H2", title: "Подзаголовок", run: () => exec("formatBlock", "<h2>") },
    { label: "H3", title: "Подзаголовок второго уровня", run: () => exec("formatBlock", "<h3>") },
    { label: "Ж", title: "Жирный", run: () => exec("bold") },
    { label: "К", title: "Курсив", run: () => exec("italic") },
    { label: "•", title: "Маркированный список", run: () => exec("insertUnorderedList") },
    { label: "1.", title: "Нумерованный список", run: () => exec("insertOrderedList") },
    { label: "❝", title: "Цитата", run: () => exec("formatBlock", "<blockquote>") },
    { label: "Ссылка", title: "Сделать выделенный текст ссылкой", run: insertLink },
    { label: "Убрать ссылку", title: "Убрать ссылку", run: () => exec("unlink") },
    { label: "Очистить", title: "Убрать оформление выделенного текста", run: () => exec("removeFormat") },
  ];

  return (
    <div className={styles.bodyEditor}>
      <div className={styles.toolbar} role="toolbar" aria-label="Оформление текста">
        {buttons.map((button) => (
          <button key={button.label} type="button" title={button.title} onMouseDown={keepSelection} onClick={button.run}>
            {button.label}
          </button>
        ))}
        <button
          type="button"
          title="Вставить изображение"
          onMouseDown={keepSelection}
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          aria-busy={uploading}
        >
          {uploading ? "…" : "IMG"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            const range = saveSelection();
            event.target.value = "";
            if (file && file.type.startsWith("image/")) {
              void insertImageFile(file, range);
            }
          }}
        />
      </div>
      <div
        ref={editorRef}
        className={styles.bodyArea}
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        onBlur={sync}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDoubleClick={handleDoubleClick}
        spellCheck
      />
    </div>
  );
}
