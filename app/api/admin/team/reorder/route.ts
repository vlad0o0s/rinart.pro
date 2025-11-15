import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-auth";
import { reorderTeamMembersEntries } from "@/lib/team";
import { invalidateTeamCache } from "@/lib/team";
import { revalidatePath } from "next/cache";

export async function POST(request: NextRequest) {
  await assertAdmin(request);
  const body = await request.json().catch(() => ({}));
  const order = Array.isArray(body?.order) ? body.order : [];

  const ids = order
    .map((item: unknown) => Number(item))
    .filter((item: number) => Number.isInteger(item) && item > 0);
  if (!ids.length) {
    return NextResponse.json({ error: "Некорректный порядок" }, { status: 400 });
  }

  try {
    await reorderTeamMembersEntries(ids);
    invalidateTeamCache();
    revalidatePath("/masterskaja");
    revalidatePath("/");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to reorder team members", error);
    return NextResponse.json({ error: "Не удалось сохранить порядок" }, { status: 500 });
  }
}

