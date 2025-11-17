import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/admin-auth";
import { createMediaAssetRecord, fetchMediaAssets, deleteMediaAssetById, findMediaAssetByUrl } from "@/lib/media-library-repository";
import { invalidateAllProjectsCache } from "@/lib/projects";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { getMimeExtension, optimizeImage } from "@/lib/image-optimization";

export const runtime = "nodejs";

const MAX_SIZE_BYTES = 15 * 1024 * 1024;

function sanitizeBaseName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function downloadToUploads(remoteUrl: string, desiredName?: string) {
  const response = await fetch(remoteUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Не удалось скачать файл по указанной ссылке");
  }

  const contentTypeHeader = response.headers.get("content-type");
  if (!contentTypeHeader) {
    throw new Error("Не удалось определить тип загружаемого файла");
  }
  const contentType = contentTypeHeader.split(";")[0].toLowerCase();

  if (!contentType.startsWith("image/")) {
    throw new Error("По ссылке нет изображения");
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length === 0) {
    throw new Error("Файл пустой");
  }
  if (buffer.length > MAX_SIZE_BYTES) {
    throw new Error("Файл слишком большой (максимум 15 МБ)");
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadDir, { recursive: true });

  let originalName = desiredName?.trim() || undefined;

  if (!originalName) {
    try {
      const parsed = new URL(remoteUrl);
      const lastSegment = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() ?? "");
      originalName = lastSegment || undefined;
    } catch {
      originalName = undefined;
    }
  }

  const sourceExtension = originalName ? path.extname(originalName).toLowerCase() : "";
  const baseName = sanitizeBaseName(
    originalName ? path.basename(originalName, path.extname(originalName)) : "image",
  );

  const { buffer: optimizedBuffer, extension: optimizedExtension } = await optimizeImage(buffer, contentType, {
    originalExtension: sourceExtension || getMimeExtension(contentType) || ".bin",
  });

  if (!optimizedBuffer || optimizedBuffer.length === 0) {
    throw new Error("Не удалось обработать изображение: результат конвертации пустой");
  }

  // Используем результат оптимизации (WebP)
  const finalExtension = optimizedExtension;

  const storedName = `${baseName || "image"}-${crypto.randomUUID()}${finalExtension}`;
  const filePath = path.join(uploadDir, storedName);

  await fs.writeFile(filePath, optimizedBuffer);

  const publicUrl = `/uploads/${storedName}`;
  const displayName =
    originalName && originalName.length
      ? originalName
      : `${(baseName || "image").replace(/-+/g, " ")}${finalExtension}`;

  return { publicUrl, displayName };
}

export async function GET(request: NextRequest) {
  await assertAdmin(request);
  const assets = await fetchMediaAssets();
  return NextResponse.json({ assets });
}

export async function POST(request: NextRequest) {
  await assertAdmin(request);
  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const providedTitle =
    typeof body?.title === "string" && body.title.trim().length ? body.title.trim() : null;

  if (!url) {
    return NextResponse.json({ error: "Укажите URL изображения" }, { status: 400 });
  }

  try {
    if (url.startsWith("/uploads/")) {
      const asset = await createMediaAssetRecord(url, providedTitle ?? path.basename(url));
      return NextResponse.json({ asset });
    }

    let assetUrl = url;
    let displayName = providedTitle ?? null;

    if (url.startsWith("http://") || url.startsWith("https://")) {
      const { publicUrl, displayName: derivedName } = await downloadToUploads(url, providedTitle ?? undefined);
      assetUrl = publicUrl;
      displayName = providedTitle ?? derivedName;
    }

    const asset = await createMediaAssetRecord(assetUrl, displayName);
    return NextResponse.json({ asset });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сохранить изображение";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  await assertAdmin(request);
  const body = await request.json().catch(() => null);
  const id = Number(body?.id);
  const url = typeof body?.url === "string" ? body.url.trim() : "";

  if (!id && !url) {
    return NextResponse.json({ error: "Не передан идентификатор или URL" }, { status: 400 });
  }

  try {
    let imageUrlToCleanup: string | null = null;

    // Delete DB record by id when provided
    if (id) {
      // deleteMediaAssetById уже получает URL и вызывает removeImageReferencesFromAllPlaces
      await deleteMediaAssetById(id);
    } else if (url) {
      const existing = await findMediaAssetByUrl(url);
      if (existing) {
        // deleteMediaAssetById уже получает URL и вызывает removeImageReferencesFromAllPlaces
        await deleteMediaAssetById(existing.id);
      } else {
        // Если записи в библиотеке нет, но нужно удалить ссылки по URL
        imageUrlToCleanup = url;
      }
    }

    // Если удаляем по URL без записи в библиотеке, все равно очищаем ссылки
    if (imageUrlToCleanup) {
      const { removeImageReferencesFromAllPlaces } = await import("@/lib/media-library-repository");
      await removeImageReferencesFromAllPlaces(imageUrlToCleanup);
    }

    // Best-effort: delete file from /public/uploads when url points there
    const targetUrl = url || imageUrlToCleanup;
    if (targetUrl && targetUrl.startsWith("/uploads/")) {
      const uploadDir = path.join(process.cwd(), "public");
      const filePath = path.join(uploadDir, targetUrl);
      try {
        await fs.unlink(filePath);
      } catch {
        // ignore missing files or fs errors
      }
    }

    // Инвалидируем кэш проектов, так как могли измениться изображения
    invalidateAllProjectsCache();
    revalidatePath("/");
    revalidatePath("/masterskaja");
    revalidatePath("/proektirovanie");

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось удалить изображение";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

