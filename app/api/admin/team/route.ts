import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-auth";
import { createTeamMemberEntry, getTeamMembers } from "@/lib/team";
import { revalidatePath } from "next/cache";

export async function GET(request: NextRequest) {
  await assertAdmin(request);
  const members = await getTeamMembers();
  return NextResponse.json({ members });
}

export async function POST(request: NextRequest) {
  await assertAdmin(request);
  const body = await request.json().catch(() => ({}));
  const { name, role, label, imageUrl, mobileImageUrl, isFeatured } = body ?? {};

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Укажите имя" }, { status: 400 });
  }

  try {
    const members = await getTeamMembers();
    const member = await createTeamMemberEntry({
      name: name.trim(),
      role: typeof role === "string" ? role : null,
      label: typeof label === "string" ? label : null,
      imageUrl: typeof imageUrl === "string" ? imageUrl : null,
      mobileImageUrl: typeof mobileImageUrl === "string" ? mobileImageUrl : null,
      isFeatured: Boolean(isFeatured),
      order: members.length,
    });

    revalidateTeamPages();
    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    console.error("Failed to create team member", error);
    return NextResponse.json({ error: "Не удалось создать участника" }, { status: 500 });
  }
}

function revalidateTeamPages() {
  revalidatePath("/masterskaja");
  revalidatePath("/");
}

