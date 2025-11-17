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

  // Конвертируем в WebP (всегда поддерживается)
  const candidate = sharp(buffer, { failOnError: false }).rotate();

  // Используем WebP для всех изображений
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

