import type { LeadRequest } from "./lead-storage";
import { UTM_KEYS } from "./lead-validation";

/**
 * Текст уведомления о заявке — один на Telegram и на почту.
 *
 * Раньше каждый канал собирал сообщение сам, и в письме были поля, которых не было
 * в Telegram. Здесь один формат: что добавили — видно в обоих каналах.
 */

function formatMoscowTime(iso: string | undefined) {
  const date = iso ? new Date(iso) : new Date();

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatLeadLines(lead: LeadRequest): string[] {
  const lines: string[] = [];

  if (lead.unverified) {
    lines.push("⚠️ Капча не подтверждена — проверьте заявку перед звонком.");
    lines.push("");
  }

  lines.push(`Имя: ${lead.name || "не указано"}`);
  lines.push(`Телефон: ${lead.phone}`);
  lines.push(`Источник: ${lead.source}`);

  const createdAt = formatMoscowTime(lead.createdAt);
  if (createdAt) {
    lines.push(`Создана: ${createdAt} (МСК)`);
  }

  const quiz = lead.quiz;
  if (quiz) {
    lines.push("");
    lines.push("Ответы квиза:");
    if (quiz.houseType) lines.push(`• Тип работ: ${quiz.houseType}`);
    if (quiz.floors) lines.push(`• Этажность: ${quiz.floors}`);
    if (quiz.area) lines.push(`• Площадь: ${quiz.area}`);
    if (quiz.timing) lines.push(`• Срок старта: ${quiz.timing}`);
    if (quiz.estimate) lines.push(`• Показанный расчёт: ${quiz.estimate}`);
  }

  const attribution = lead.attribution;
  if (attribution && Object.keys(attribution).length) {
    const marks: string[] = [];

    for (const key of UTM_KEYS) {
      const value = attribution[key];
      if (value) {
        marks.push(`• ${key}: ${value}`);
      }
    }

    if (attribution.yclid) {
      marks.push(`• yclid: ${attribution.yclid}`);
    }

    if (marks.length) {
      lines.push("");
      lines.push("Реклама:");
      lines.push(...marks);
    }

    if (attribution.pageUrl || attribution.referrer || attribution.landingPage) {
      lines.push("");
      if (attribution.pageUrl) lines.push(`Страница: ${attribution.pageUrl}`);
      if (attribution.landingPage) lines.push(`Страница входа: ${attribution.landingPage}`);
      if (attribution.referrer) lines.push(`Переход с: ${attribution.referrer}`);
    }
  }

  return lines;
}
