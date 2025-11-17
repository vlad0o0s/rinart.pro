import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  try {
    const { path: pathSegments } = await context.params;
    const filePath = pathSegments.join("/");
    
    // Безопасность: проверяем, что путь не выходит за пределы uploads
    if (filePath.includes("..") || filePath.startsWith("/")) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const fullPath = path.join(process.cwd(), "public", "uploads", filePath);
    
    // Проверяем, что файл существует
    try {
      await fs.access(fullPath);
    } catch {
      return new NextResponse("Not Found", { status: 404 });
    }

    const fileBuffer = await fs.readFile(fullPath);
    const ext = path.extname(filePath).toLowerCase();
    
    // Определяем MIME тип
    const mimeTypes: Record<string, string> = {
      ".webp": "image/webp",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".avif": "image/avif",
    };
    
    const contentType = mimeTypes[ext] || "application/octet-stream";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving upload file:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

