import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { findAdminUserByLogin, createAdminSession, deleteExpiredAdminSessions } from "@/lib/admin-repository";
import { applyAdminSessionCookie, getSessionMaxAgeSeconds } from "@/lib/admin-auth";
import { verifyRecaptchaToken } from "@/lib/recaptcha";

export async function POST(request: NextRequest) {
  try {
    const { login, password, recaptchaToken } = (await request.json().catch(() => ({}))) as {
      login?: string;
      password?: string;
      recaptchaToken?: string;
    };

    if (!login || !password) {
      return NextResponse.json({ error: "Введите логин и пароль" }, { status: 400 });
    }

    // Captcha enabled
    const shouldVerifyRecaptcha = true;
    if (shouldVerifyRecaptcha) {
      const forwardedFor = request.headers.get("x-forwarded-for");
      const remoteIp = forwardedFor?.split(",")[0]?.trim();
      const isRecaptchaValid = await verifyRecaptchaToken(recaptchaToken, remoteIp);
      if (!isRecaptchaValid) {
        return NextResponse.json({ error: "Подтвердите, что вы не робот" }, { status: 400 });
      }
    }

    await deleteExpiredAdminSessions();
    const user = await findAdminUserByLogin(login.trim());
    if (!user) {
      await waitRandomDelay();
      return NextResponse.json({ error: "Неверные учетные данные" }, { status: 401 });
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      await waitRandomDelay();
      return NextResponse.json({ error: "Неверные учетные данные" }, { status: 401 });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + getSessionMaxAgeSeconds() * 1000);
    await createAdminSession(user.id, token, expiresAt);

    const response = NextResponse.json({ success: true });
    applyAdminSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error("Admin login failed", error);
    return NextResponse.json({ error: "Не удалось выполнить вход" }, { status: 500 });
  }
}

async function waitRandomDelay() {
  const delay = 200 + Math.floor(Math.random() * 200);
  await new Promise((resolve) => setTimeout(resolve, delay));
}
