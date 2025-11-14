import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/admin-auth";
import { reorderProjects } from "@/lib/project-repository";

export async function POST(request: NextRequest) {
  await assertAdmin(request);

  const body = await request.json();
  const order = Array.isArray(body?.order)
    ? body.order.filter((item: unknown): item is string => typeof item === "string")
    : [];

  await reorderProjects(order);

  revalidatePath("/");

  return NextResponse.json({ success: true });
}
