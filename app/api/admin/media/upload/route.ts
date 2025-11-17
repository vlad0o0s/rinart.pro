import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-auth";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { getMimeExtension, optimizeImage } from "@/lib/image-optimization";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  await assertAdmin(request);

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Поддерживаются только изображения" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length === 0) {
    return NextResponse.json({ error: "Файл пустой" }, { status: 400 });
  }

  const MAX_SIZE_BYTES = 15 * 1024 * 1024;
  if (buffer.length > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Файл слишком большой (максимум 15 МБ)" }, { status: 413 });
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadDir, { recursive: true });

  const originalExtension = path.extname(file.name || "").toLowerCase() || getMimeExtension(file.type) || ".bin";
  const baseName = file.name
    ? path
        .basename(file.name, path.extname(file.name))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    : "image";

  const mimeType = file.type.split(";")[0];
  
  try {
    const { buffer: optimizedBuffer, extension: optimizedExtension, mimeType: optimizedMime } = await optimizeImage(
      buffer,
      mimeType,
      { originalExtension },
    );

    if (!optimizedBuffer || optimizedBuffer.length === 0) {
      return NextResponse.json({ error: "Не удалось обработать изображение: результат конвертации пустой" }, { status: 500 });
    }

    // Используем результат оптимизации (AVIF или WebP в зависимости от поддержки)
    const finalExtension = optimizedExtension;
    const finalMimeType = optimizedMime;

    const storedName = `${baseName || "image"}-${crypto.randomUUID()}${finalExtension}`;
    const filePath = path.join(uploadDir, storedName);
    await fs.writeFile(filePath, optimizedBuffer);

    const publicUrl = `/uploads/${storedName}`;

    return NextResponse.json({
      url: publicUrl,
      originalName: file.name,
      size: optimizedBuffer.length,
      mimeType: finalMimeType,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось обработать изображение";
    console.error("Image optimization failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
