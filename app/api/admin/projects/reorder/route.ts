import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/admin-auth";
import { reorderProjects } from "@/lib/project-repository";
import { invalidateAllProjectsCache } from "@/lib/projects";

export async function POST(request: NextRequest) {
  await assertAdmin(request);

  const body = await request.json();
  const order = Array.isArray(body?.order)
    ? body.order.filter((item: unknown): item is string => typeof item === "string")
    : [];

  if (!order.length) {
    return NextResponse.json({ error: "Order array is empty" }, { status: 400 });
  }

  try {
    await reorderProjects(order);
  } catch (error) {
    console.error("[reorder] Failed to update order:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }

  // Инвалидируем кеш проектов, чтобы при обновлении страницы админки загружался новый порядок
  invalidateAllProjectsCache();
  
  // Инвалидируем главную страницу и админку (включая layout)
  revalidatePath("/", "page");
  revalidatePath("/", "layout");
  revalidatePath("/admin", "page");
  revalidatePath("/admin", "layout");

  const response = NextResponse.json({ success: true });
  // Устанавливаем заголовки для предотвращения кеширования ответа
  response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  
  return response;
}
