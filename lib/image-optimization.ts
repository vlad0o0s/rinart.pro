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

// Проверяем поддержку AVIF один раз при загрузке модуля
let avifSupportChecked = false;
let hasAvifSupport = false;

async function checkAvifSupport(): Promise<boolean> {
  if (avifSupportChecked) {
    return hasAvifSupport;
  }
  
  try {
    // Создаем минимальное тестовое изображение (1x1 пиксель PNG)
    const testPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );
    const testBuffer = await sharp(testPng).avif({ quality: 1, effort: 1 }).toBuffer();
    hasAvifSupport = testBuffer && testBuffer.length > 0;
  } catch {
    hasAvifSupport = false;
  }
  
  avifSupportChecked = true;
  return hasAvifSupport;
}

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

  // Пробуем конвертировать в AVIF, если поддерживается, иначе в WebP
  const candidate = sharp(buffer, { failOnError: false }).rotate();
  
  // Проверяем поддержку AVIF (проверка выполняется один раз)
  const supportsAvif = await checkAvifSupport();

  // Попытка 1: AVIF (если поддерживается)
  if (supportsAvif) {
    try {
      const avifBuffer = await candidate.clone().avif({ quality: 60, effort: 4 }).toBuffer();
      if (avifBuffer && avifBuffer.length > 0) {
        return { buffer: avifBuffer, extension: ".avif", mimeType: "image/avif" };
      }
    } catch (error) {
      console.warn("AVIF conversion failed, falling back to WebP:", error instanceof Error ? error.message : "unknown error");
    }

    // Попытка 2: более агрессивные настройки AVIF
    try {
      const avifBuffer = await candidate.clone().avif({ quality: 50, effort: 6 }).toBuffer();
      if (avifBuffer && avifBuffer.length > 0) {
        return { buffer: avifBuffer, extension: ".avif", mimeType: "image/avif" };
      }
    } catch (error) {
      console.warn("AVIF conversion failed, falling back to WebP:", error instanceof Error ? error.message : "unknown error");
    }

    // Попытка 3: максимально агрессивные настройки AVIF
    try {
      const avifBuffer = await candidate.clone().avif({ quality: 40, effort: 9 }).toBuffer();
      if (avifBuffer && avifBuffer.length > 0) {
        return { buffer: avifBuffer, extension: ".avif", mimeType: "image/avif" };
      }
    } catch (error) {
      console.warn("AVIF conversion failed, falling back to WebP:", error instanceof Error ? error.message : "unknown error");
    }
  }

  // Fallback: WebP (всегда поддерживается)
  try {
    const webpBuffer = await candidate.clone().webp({ quality: 75, effort: 4 }).toBuffer();
    if (webpBuffer && webpBuffer.length > 0) {
      return { buffer: webpBuffer, extension: ".webp", mimeType: "image/webp" };
    }
  } catch (error) {
    console.warn("WebP conversion failed:", error instanceof Error ? error.message : "unknown error");
  }

  // Если все попытки не удались, возвращаем оригинал
  console.warn("Image conversion failed, returning original");
  return { buffer, extension: defaultExtension, mimeType };
}

export function getMimeExtension(mimeType: string | null | undefined): string | undefined {
  if (!mimeType) {
    return undefined;
  }
  return MIME_EXTENSION_MAP[mimeType.toLowerCase()];
}

