const VERIFY_URL = "https://smartcaptcha.yandexcloud.net/validate";

type SmartCaptchaVerifyResponse = {
  status?: "ok" | "failed";
  message?: string;
};

export async function verifyYandexSmartCaptcha(token?: string | null, remoteIp?: string | null) {
  const secret = process.env.YANDEX_SMARTCAPTCHA_SERVER_KEY;

  if (!secret) {
    console.warn("Yandex SmartCaptcha server key is not configured");
    return false;
  }

  if (!token) {
    return false;
  }

  const params = new URLSearchParams({
    secret,
    token,
  });

  if (remoteIp) {
    params.set("ip", remoteIp);
  }

  try {
    const response = await fetch(`${VERIFY_URL}?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn("Yandex SmartCaptcha verify request failed", response.status, response.statusText);
      return false;
    }

    const payload = (await response.json()) as SmartCaptchaVerifyResponse;
    return payload.status === "ok";
  } catch (error) {
    console.error("Yandex SmartCaptcha verification error", error);
    return false;
  }
}
