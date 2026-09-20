"use client";

/**
 * Загрузка картинок из редакторов админки — описания проектов и статей.
 * Файл уходит в uploads, в HTML — только ссылка с размерами и подписью.
 */

export class AdminAuthError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "AdminAuthError";
  }
}

export type InlineImageUpload = { url: string; width?: number; height?: number };

export async function uploadInlineImage(file: File): Promise<InlineImageUpload> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("mode", "inline");
  const response = await fetch("/api/admin/media/upload", { method: "POST", body: formData, credentials: "include" });
  if (response.status === 401) {
    throw new AdminAuthError();
  }
  const data = (await response.json().catch(() => null)) as (InlineImageUpload & { error?: string }) | null;
  if (!response.ok || !data?.url) {
    throw new Error(data?.error || `Не удалось загрузить изображение (${response.status})`);
  }
  return data;
}

export function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escapeHtmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** HTML картинки для вставки в редактор. */
export function inlineImageHtml(image: { src: string; alt: string; width?: number; height?: number }): string {
  const size = image.width && image.height ? ` width="${image.width}" height="${image.height}"` : "";
  return `<img src="${escapeHtmlAttr(image.src.trim())}" alt="${escapeHtmlAttr(image.alt)}"${size} loading="lazy" decoding="async">`;
}

/**
 * Подпись (alt) обязательна: по ней поиск понимает, что на картинке. null — вставку отменили.
 */
export function askImageAlt(currentValue: string): string | null {
  let value = currentValue;
  for (;;) {
    const answer = window.prompt(
      "Что на изображении? Например: «План первого этажа», «Фасад со стороны сада». Подпись видят поиск и незрячие посетители.",
      value,
    );
    if (answer === null) {
      return null;
    }
    if (answer.trim()) {
      return answer.trim();
    }
    value = "";
  }
}
