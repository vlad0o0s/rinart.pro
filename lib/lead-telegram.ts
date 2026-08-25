import { formatLeadLines } from "./lead-message";
import type { LeadRequest } from "./lead-storage";

/**
 * Уведомление о заявке в Telegram.
 *
 * Переменные читаются при каждом вызове, а не при загрузке модуля: иначе добавленный
 * в `.env` токен начинал работать только после пересборки, и «канал молчит» выглядело
 * как поломка кода.
 */

function getConfig() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = (process.env.TELEGRAM_CHAT_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return { botToken, chatIds };
}

export function isLeadTelegramConfigured() {
  const { botToken, chatIds } = getConfig();
  return Boolean(botToken && chatIds.length);
}

/**
 * Возвращает `true`, только если сообщение реально принято хотя бы одним чатом.
 * Прежняя версия ждала `allSettled` и выбрасывала результат: Telegram мог ответить
 * 400 «chat not found», а код считал, что уведомление ушло.
 */
export async function sendLeadTelegram(lead: LeadRequest): Promise<boolean> {
  const { botToken, chatIds } = getConfig();

  if (!botToken || !chatIds.length) {
    return false;
  }

  const text = [
    "🔥 Новая заявка с сайта RINART",
    "",
    ...formatLeadLines(lead),
    "",
    "Позвонить в течение 15 минут — тёплый лид остывает за час.",
  ].join("\n");

  const results = await Promise.allSettled(
    chatIds.map(async (chatId) => {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      });

      if (!response.ok) {
        throw new Error(`telegram_http_${response.status}`);
      }

      return true;
    }),
  );

  return results.some((result) => result.status === "fulfilled");
}
