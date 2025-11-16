import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-auth";
import { deleteTeamMemberEntry, updateTeamMemberEntry } from "@/lib/team";
import { revalidatePath } from "next/cache";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await assertAdmin(request);
  const { id } = await context.params;
  const numericId = Number(id);
  if (!numericId || Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Некорректный идентификатор" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const payload: Record<string, unknown> = body ?? {};

  try {
    const member = await updateTeamMemberEntry(numericId, {
      name: typeof payload.name === "string" ? payload.name : undefined,
      role: payload.role === null ? null : typeof payload.role === "string" ? payload.role : undefined,
      label: payload.label === null ? null : typeof payload.label === "string" ? payload.label : undefined,
      imageUrl: payload.imageUrl === null ? null : typeof payload.imageUrl === "string" ? payload.imageUrl : undefined,
      mobileImageUrl:
        payload.mobileImageUrl === null
          ? null
          : typeof payload.mobileImageUrl === "string"
            ? payload.mobileImageUrl
            : undefined,
      isFeatured: typeof payload.isFeatured === "boolean" ? payload.isFeatured : undefined,
      order: typeof payload.order === "number" ? payload.order : undefined,
    });

    revalidateTeamPages();
    return NextResponse.json({ member });
  } catch (error) {
    console.error("Failed to update team member", error);
    return NextResponse.json({ error: "Не удалось обновить участника" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await assertAdmin(request);
  const { id } = await context.params;
  const numericId = Number(id);
  if (!numericId || Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Некорректный идентификатор" }, { status: 400 });
  }

  try {
    await deleteTeamMemberEntry(numericId);
    revalidateTeamPages();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete team member", error);
    return NextResponse.json({ error: "Не удалось удалить участника" }, { status: 500 });
  }
}

function revalidateTeamPages() {
  revalidatePath("/masterskaja");
  revalidatePath("/");
}

