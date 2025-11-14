import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import {
  deleteAdminSession,
  deleteExpiredAdminSessions,
  getAdminSessionByToken,
  AdminUserRecord,
} from "./admin-repository";

export const SESSION_COOKIE_NAME = "admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 дней

export type AdminSession = {
  token: string;
  user: AdminUserRecord;
  expiresAt: Date;
};

export async function assertAdmin(request: NextRequest): Promise<AdminSession> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    throwUnauthorized();
  }

  await deleteExpiredAdminSessions();
  const record = await getAdminSessionByToken(token);
  if (!record) {
    await deleteAdminSession(token).catch(() => {});
    throwUnauthorized();
  }

  const expired = record.expiresAt.getTime() <= Date.now();
  if (expired) {
    await deleteAdminSession(token).catch(() => {});
    throwUnauthorized();
  }

  return {
    token: record.token,
    user: record.user,
    expiresAt: record.expiresAt,
  };
}

export function applyAdminSessionCookie(response: NextResponse, token: string, maxAgeSeconds = SESSION_MAX_AGE_SECONDS) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    maxAge: maxAgeSeconds,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getAdminSessionFromCookies(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  await deleteExpiredAdminSessions();
  const record = await getAdminSessionByToken(token);
  if (!record || record.expiresAt.getTime() <= Date.now()) {
    await deleteAdminSession(token).catch(() => {});
    return null;
  }
  return {
    token: record.token,
    user: record.user,
    expiresAt: record.expiresAt,
  };
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSessionFromCookies();
  if (!session) {
    redirect("/admin/login");
  }
  return session;
}

export function getSessionMaxAgeSeconds() {
  return SESSION_MAX_AGE_SECONDS;
}

function throwUnauthorized(): never {
  throw new Response("Unauthorized", { status: 401 });
}
