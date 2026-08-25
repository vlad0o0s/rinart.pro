const VERIFY_URL = "https://smartcaptcha.yandexcloud.net/validate";

/** Сколько ждём ответ сервиса проверки, прежде чем считать его недоступным. */
const VERIFY_TIMEOUT_MS = 4000;

type SmartCaptchaVerifyResponse = {
  status?: "ok" | "failed";
  message?: string;
};

/**
 * Три исхода вместо двух.
 *
 * Раньше функция возвращала `false` и когда токен поддельный, и когда сервис Яндекса
 * не ответил. Роут в обоих случаях отвечал 400, то есть падение чужого сервиса
 * выбрасывало заявку живого человека. Теперь «не прошёл» и «не смогли проверить» —
 * разные исходы, и решение по ним принимает вызывающий код.
 */
export type CaptchaVerdict =
  /** Токен проверен сервисом — это человек. */
  | { status: "ok" }
  /** Сервис ответил, что проверка не пройдена. */
  | { status: "failed" }
  /** Проверить не удалось: нет ключа, сеть, таймаут, неожиданный ответ. */
  | { status: "unavailable"; reason: string };

export async function verifyYandexSmartCaptcha(
  token?: string | null,
  remoteIp?: string | null,
): Promise<CaptchaVerdict> {
  const secret = process.env.YANDEX_SMARTCAPTCHA_SERVER_KEY;

  if (!secret) {
    return { status: "unavailable", reason: "server_key_missing" };
  }

  if (!token) {
    return { status: "unavailable", reason: "token_missing" };
  }

  const params = new URLSearchParams({ secret, token });

  if (remoteIp) {
    params.set("ip", remoteIp);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

  try {
    const response = await fetch(`${VERIFY_URL}?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return { status: "unavailable", reason: `http_${response.status}` };
    }

    const payload = (await response.json()) as SmartCaptchaVerifyResponse;

    if (payload.status === "ok") {
      return { status: "ok" };
    }

    if (payload.status === "failed") {
      return { status: "failed" };
    }

    return { status: "unavailable", reason: "unexpected_response" };
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    return { status: "unavailable", reason: aborted ? "timeout" : "network_error" };
  } finally {
    clearTimeout(timer);
  }
}
