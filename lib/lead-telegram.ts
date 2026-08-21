import type { LeadRequest } from "./lead-storage";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_IDS = (process.env.TELEGRAM_CHAT_IDS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export function isLeadTelegramConfigured() {
  return Boolean(BOT_TOKEN && CHAT_IDS.length);
}

export async function sendLeadTelegram(lead: LeadRequest) {
  if (!isLeadTelegramConfigured()) {
    return;
  }

  const text = [
    "🔥 Новая заявка с сайта RINART",
    "",
    `Имя: ${lead.name}`,
    `Телефон: ${lead.phone}`,
    `Источник: ${lead.source}`,
    "",
    "Позвонить в течение 15 минут — тёплый лид остывает за час.",
  ].join("\n");

  await Promise.allSettled(
    CHAT_IDS.map((chatId) =>
      fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      }),
    ),
  );
}
