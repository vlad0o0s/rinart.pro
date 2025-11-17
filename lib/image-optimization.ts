import sharp from "sharp";
import { execFile } from "child_process";
import { promisify } from "util";
import { tmpdir } from "os";
import { join } from "path";
import { writeFile, unlink, readFile } from "fs/promises";

const execFileAsync = promisify(execFile);

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

// Проверяем поддержку AVIF в Sharp
let avifSupportChecked = false;
let hasAvifSupport = false;

async function checkAvifSupport(): Promise<boolean> {
  if (avifSupportChecked) {
    return hasAvifSupport;
  }
  
  try {
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

// Конвертация через avifenc (fallback)
async function convertToAvifWithAvifenc(inputBuffer: Buffer): Promise<Buffer | null> {
  try {
    const tempInput = join(tmpdir(), `input-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
    const tempOutput = join(tmpdir(), `output-${Date.now()}-${Math.random().toString(36).slice(2)}.avif`);
    
    // Сначала конвертируем в PNG через Sharp (если нужно)
    let pngBuffer = inputBuffer;
    try {
      const metadata = await sharp(inputBuffer).metadata();
      if (metadata.format !== "png") {
        pngBuffer = await sharp(inputBuffer).png().toBuffer();
      }
    } catch {
      // Если не удалось, пробуем исходный буфер
    }
    
    await writeFile(tempInput, pngBuffer);
    
    try {
      await execFileAsync("avifenc", [
        "-c", "aom",
        "-s", "4", // speed
        "-q", "60", // quality
        "-y", "420", // yuv format
        tempInput,
        tempOutput,
      ]);
      
      const avifBuffer = await readFile(tempOutput);
      await unlink(tempInput).catch(() => {});
      await unlink(tempOutput).catch(() => {});
      
      return avifBuffer.length > 0 ? avifBuffer : null;
    } catch (error) {
      await unlink(tempInput).catch(() => {});
      await unlink(tempOutput).catch(() => {});
      return null;
    }
  } catch {
    return null;
  }
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

  const candidate = sharp(buffer, { failOnError: false }).rotate();
  const supportsAvif = await checkAvifSupport();

  // Попытка 1: AVIF через Sharp (если поддерживается)
  if (supportsAvif) {
    try {
      const avifBuffer = await candidate.clone().avif({ quality: 60, effort: 4 }).toBuffer();
      if (avifBuffer && avifBuffer.length > 0) {
        return { buffer: avifBuffer, extension: ".avif", mimeType: "image/avif" };
      }
    } catch (error) {
      console.warn("AVIF conversion via Sharp failed:", error instanceof Error ? error.message : "unknown error");
    }
  }

  // Попытка 2: AVIF через avifenc (fallback)
  try {
    const avifBuffer = await convertToAvifWithAvifenc(buffer);
    if (avifBuffer && avifBuffer.length > 0) {
      return { buffer: avifBuffer, extension: ".avif", mimeType: "image/avif" };
    }
  } catch (error) {
    console.warn("AVIF conversion via avifenc failed:", error instanceof Error ? error.message : "unknown error");
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

