/**
 * Сводка заявок по месяцам и источникам для раздела «Заявки» в админке.
 * Тестовые заявки в итоги не входят — они считаются отдельно.
 */

import type { Attribution } from "./lead-validation";
import { LEAD_SOURCES, classifyLeadSource, type LeadSourceId } from "./lead-source";

export type CountableLead = {
  createdAt: string;
  attribution?: Attribution;
  isTest?: boolean;
};

export type LeadMonthRow = {
  /** Месяц по московскому времени, `2026-09`. */
  month: string;
  total: number;
  bySource: Record<LeadSourceId, number>;
};

export type LeadSummary = {
  months: LeadMonthRow[];
  testCount: number;
};

const moscowMonth = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Moscow",
  year: "numeric",
  month: "2-digit",
});

/** Заявка в 01:30 по Москве первого числа относится к новому месяцу, хотя по UTC ещё старый. */
export function moscowMonthKey(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const parts = moscowMonth.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return year && month ? `${year}-${month}` : null;
}

function emptyCounts(): Record<LeadSourceId, number> {
  return Object.fromEntries(LEAD_SOURCES.map((source) => [source.id, 0])) as Record<LeadSourceId, number>;
}

export function summarizeLeads(leads: CountableLead[]): LeadSummary {
  const rows = new Map<string, LeadMonthRow>();
  let testCount = 0;

  for (const lead of leads) {
    if (lead.isTest) {
      testCount += 1;
      continue;
    }

    const month = moscowMonthKey(lead.createdAt);
    if (!month) {
      continue;
    }

    let row = rows.get(month);
    if (!row) {
      row = { month, total: 0, bySource: emptyCounts() };
      rows.set(month, row);
    }

    row.total += 1;
    row.bySource[classifyLeadSource(lead.attribution)] += 1;
  }

  return {
    months: [...rows.values()].sort((a, b) => b.month.localeCompare(a.month)),
    testCount,
  };
}
