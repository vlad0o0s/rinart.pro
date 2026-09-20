import path from "node:path";
import { createUploadsPersister, hashBytes, replaceInlineImages } from "./inline-images.cjs";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

export type InlineImageFile = { url: string; width?: number; height?: number; bytes?: number; format?: string };

/**
 * Картинка для описания проекта: файл в uploads, в HTML — только ссылка.
 * null — формат нельзя вставить в описание (например, SVG).
 */
export async function saveInlineImage(bytes: Buffer): Promise<InlineImageFile | null> {
  const persist = createUploadsPersister({ uploadsDir: UPLOADS_DIR });
  return persist(bytes, hashBytes(bytes));
}

/**
 * Страховка при сохранении описания: если в HTML всё же пришли картинки base64 — из открытой
 * до обновления вкладки админки или перетащенные откуда-то ещё, — переносим их в файлы, а не
 * сохраняем в базу. Подпись для картинки без alt — название проекта.
 */
export async function moveInlineImagesToUploads(html: string, fallbackAlt: string): Promise<string> {
  if (!html.includes("data:image")) {
    return html;
  }
  const persist = createUploadsPersister({ uploadsDir: UPLOADS_DIR });
  const { html: result } = await replaceInlineImages(html, { persist, altFor: () => fallbackAlt });
  return result;
}
