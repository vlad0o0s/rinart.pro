import sharp from "sharp";

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
  "image/tiff": ".tiff",
};

const NON_CONVERTIBLE_MIME = new Set(["image/gif", "image/svg+xml"]);

type OptimizationResult = {
  buffer: Buffer;
  extension: string;
  mimeType: string;
};

export async function optimizeImage(
  buffer: Buffer,
  mimeType: string,
  options?: { originalExtension?: string },
): Promise<OptimizationResult> {
  const defaultExtension =
    options?.originalExtension && options.originalExtension.length
      ? options.originalExtension
      : MIME_EXTENSION_MAP[mimeType] ?? ".bin";

  if (!buffer.length) {
    return { buffer, extension: defaultExtension, mimeType };
  }

  if (NON_CONVERTIBLE_MIME.has(mimeType)) {
    return { buffer, extension: defaultExtension, mimeType };
  }

  // Всегда конвертируем в AVIF, даже если входной файл уже WEBP
  // Сначала пробуем нормальные настройки
  const candidate = sharp(buffer, { failOnError: false }).rotate();

  // Попытка 1: нормальные настройки AVIF
  try {
    const avifBuffer = await candidate.clone().avif({ quality: 60, effort: 4 }).toBuffer();
    if (avifBuffer.length > 0) {
      return { buffer: avifBuffer, extension: ".avif", mimeType: "image/avif" };
    }
  } catch {
    // Продолжаем попытки
  }

  // Попытка 2: более агрессивные настройки AVIF (ниже quality, выше effort)
  try {
    const avifBuffer = await candidate.clone().avif({ quality: 50, effort: 6 }).toBuffer();
    if (avifBuffer.length > 0) {
      return { buffer: avifBuffer, extension: ".avif", mimeType: "image/avif" };
    }
  } catch {
    // Продолжаем попытки
  }

  // Попытка 3: максимально агрессивные настройки AVIF
  try {
    const avifBuffer = await candidate.clone().avif({ quality: 40, effort: 9 }).toBuffer();
    if (avifBuffer.length > 0) {
      return { buffer: avifBuffer, extension: ".avif", mimeType: "image/avif" };
    }
  } catch (error) {
    // Если даже это не помогло, выбрасываем ошибку
    throw new Error(`Не удалось конвертировать изображение в AVIF: ${error instanceof Error ? error.message : "неизвестная ошибка"}`);
  }

  // Этот код не должен выполняться, но на случай если все попытки вернули пустой буфер
  throw new Error("Не удалось конвертировать изображение в AVIF: результат конвертации пустой");
}

export function getMimeExtension(mimeType: string | null | undefined): string | undefined {
  if (!mimeType) {
    return undefined;
  }
  return MIME_EXTENSION_MAP[mimeType.toLowerCase()];
}

