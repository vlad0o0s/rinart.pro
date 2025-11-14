import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, clearAdminSessionCookie } from "@/lib/admin-auth";
import { deleteAdminSession } from "@/lib/admin-repository";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await deleteAdminSession(token).catch(() => {});
  }

  const response = NextResponse.json({ success: true });
  clearAdminSessionCookie(response);
  return response;
}
