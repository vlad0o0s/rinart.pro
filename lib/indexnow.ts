// IndexNow: сообщаем Яндексу об адресах, которые появились, заметно изменились или исчезли,
// чтобы не ждать планового обхода. Принятое уведомление не равно обходу и тем более
// индексации — это только повод прийти раньше.
//
// Ключ протокола не секрет: он по устройству лежит открытым файлом на самом сайте
// (public/<ключ>.txt) и нужен лишь для того, чтобы подтвердить — уведомление отправил
// владелец домена, а не посторонний.

import { SITE_URL } from "./seo/schema";

export const INDEXNOW_KEY = "6c35dc157e5b9038503dc415a5d579f4";
export const INDEXNOW_KEY_LOCATION = `${SITE_URL}/${INDEXNOW_KEY}.txt`;

const ENDPOINT = "https://yandex.com/indexnow";
/** Протокол разрешает до 10 000 адресов за раз; нам столько не нужно, а ограничение бережёт от ошибок. */
const MAX_URLS = 100;
const TIMEOUT_MS = 5000;

export type IndexNowRequest = {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
};

/** Приводит пути и адреса к абсолютным, отбрасывает чужие домены, мусор и повторы. */
export function buildIndexNowRequest(paths: readonly string[]): IndexNowRequest | null {
  const host = new URL(SITE_URL).host;
  const urlList: string[] = [];

  for (const path of paths) {
    if (typeof path !== "string" || !path.trim()) {
      continue;
    }

    let absolute: URL;
    try {
      absolute = new URL(path.trim(), `${SITE_URL}/`);
    } catch {
      continue;
    }

    if (absolute.host !== host) {
      continue;
    }

    const normalised = absolute.toString();
    if (!urlList.includes(normalised)) {
      urlList.push(normalised);
    }
  }

  if (!urlList.length) {
    return null;
  }

  return { host, key: INDEXNOW_KEY, keyLocation: INDEXNOW_KEY_LOCATION, urlList: urlList.slice(0, MAX_URLS) };
}

/**
 * Отправляет уведомление и никогда не мешает основной работе: сохранение статьи или
 * проекта не должно падать из-за того, что внешний сервис не ответил.
 */
export async function notifyIndexNow(paths: readonly string[]): Promise<void> {
  const payload = buildIndexNowRequest(paths);
  if (!payload) {
    return;
  }

  // На стенде и в разработке уведомления не шлём: Яндексу нечего обходить по localhost.
  if (process.env.NODE_ENV !== "production" || process.env.INDEXNOW_DISABLED === "1") {
    return;
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      console.warn("[indexnow] ответ", response.status, payload.urlList.join(" "));
    }
  } catch (error) {
    console.warn("[indexnow] не отправлено", error instanceof Error ? error.message : error);
  }
}
