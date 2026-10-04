import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { LEAD_RETENTION_YEARS } from "./legal";
import type { Attribution, QuizContext } from "./lead-validation";

export type LeadRequest = {
  name: string;
  phone: string;
  source: string;
  ip?: string | null;
  /** Ответы квиза: с ними звонок начинается не с «расскажите, что вы хотели». */
  quiz?: QuizContext | null;
  /** Метки рекламы — по ним видно, какая кампания привела заявку. */
  attribution?: Attribution;
  /**
   * Согласие на обработку данных: редакция текста, которую видел человек, и браузер,
   * из которого оно дано. Вместе с временем, адресом страницы и IP это и есть
   * доказательство согласия — предоставить его обязан оператор.
   */
  consent?: { edition: string; userAgent?: string };
  /** Капчу подтвердить не удалось: заявку приняли, но она требует внимания. */
  unverified?: boolean;
  /** Время создания на сервере: часам на клиенте доверять нельзя. */
  createdAt?: string;
};

export type StoredLead = LeadRequest & {
  createdAt: string;
  /** У заявок, сохранённых до появления счётчика в админке, идентификатора нет. */
  id?: string;
  /** Проверочная заявка: в итоги счётчика не входит. */
  isTest?: boolean;
};

const LEADS_FILE = path.join(process.cwd(), "data", "leads.json");

/**
 * Запись сериализуется. Без этого две заявки, пришедшие почти одновременно, успевали
 * прочитать файл до записи друг друга — и одна из них молча терялась.
 *
 * Очередь лежит в globalThis: в файл пишут два роута (приём заявок и админка), а Next
 * может собрать их в отдельные бандлы со своей копией модуля — и своей очередью.
 */
const chainHolder = globalThis as typeof globalThis & { __rinartLeadWriteChain?: Promise<void> };

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const previous = chainHolder.__rinartLeadWriteChain ?? Promise.resolve();
  const task = previous.then(operation, operation);
  chainHolder.__rinartLeadWriteChain = task.then(
    () => {},
    () => {},
  );
  return task;
}

/** Ключ заявки для админки: у старых записей идентификатора нет, их отличает время создания. */
export function leadKey(lead: StoredLead): string {
  return lead.id ?? `ts:${lead.createdAt}`;
}

export async function saveLead(lead: LeadRequest) {
  return enqueue(() => appendLead(lead));
}

/** Список заявок для админки. Нечитаемый файл — это ошибка, а не «заявок нет». */
export async function readLeads(): Promise<StoredLead[]> {
  try {
    const parsed = JSON.parse(await readFile(LEADS_FILE, "utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as StoredLead[]) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

/** Помечает заявку как проверочную или снимает отметку. `false` — заявка не найдена. */
export async function setLeadTestFlag(key: string, isTest: boolean): Promise<boolean> {
  return enqueue(async () => {
    const leads = await readLeads();
    const lead = leads.find((item) => leadKey(item) === key);

    if (!lead) {
      return false;
    }

    if (isTest) {
      lead.isTest = true;
    } else {
      delete lead.isTest;
    }

    await writeLeads(leads);
    return true;
  });
}

/** Удаляет заявку — например, по требованию человека. `false` — заявка не найдена. */
export async function deleteLead(key: string): Promise<boolean> {
  return enqueue(async () => {
    const leads = await readLeads();
    const removed = leads.filter((item) => leadKey(item) === key);

    if (!removed.length) {
      return false;
    }

    await writeLeads(leads.filter((item) => leadKey(item) !== key));
    await recordDeletions(removed, "manual");
    return true;
  });
}

/**
 * Журнал удалений: когда и почему заявка уничтожена. Имени и телефона в нём нет — журнал
 * не должен хранить то, что удалено; заявку в нём обозначает её идентификатор и дата.
 * По журналу оператор подтверждает уничтожение данных, если об этом спросят.
 */
export type LeadDeletion = {
  lead: string;
  leadCreatedAt: string;
  deletedAt: string;
  /** `manual` — удалена в админке (в том числе по требованию человека), `retention` — истёк срок хранения. */
  reason: "manual" | "retention";
};

const DELETIONS_FILE = path.join(process.cwd(), "data", "lead-deletions.json");
const DELETIONS_LIMIT = 2000;

export async function readLeadDeletions(): Promise<LeadDeletion[]> {
  try {
    const parsed = JSON.parse(await readFile(DELETIONS_FILE, "utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as LeadDeletion[]) : [];
  } catch {
    // Журнала ещё нет или он не читается — удалению заявок это мешать не должно.
    return [];
  }
}

async function recordDeletions(leads: StoredLead[], reason: LeadDeletion["reason"]) {
  if (!leads.length) {
    return;
  }
  try {
    const deletedAt = new Date().toISOString();
    const entries: LeadDeletion[] = leads.map((lead) => ({
      lead: leadKey(lead),
      leadCreatedAt: lead.createdAt,
      deletedAt,
      reason,
    }));
    const journal = [...entries, ...(await readLeadDeletions())].slice(0, DELETIONS_LIMIT);
    const tmpFile = DELETIONS_FILE + ".tmp";
    await writeFile(tmpFile, JSON.stringify(journal, null, 2), "utf8");
    await rename(tmpFile, DELETIONS_FILE);
  } catch (error) {
    // Заявка уже удалена; сбой записи журнала — повод посмотреть в журнал сервера, а не отказ.
    console.error("[lead] deletion journal failed", error);
  }
}

/**
 * Заявка хранится не дольше срока, на который дано согласие. Запись с нечитаемой датой
 * остаётся: молча потерять заявку из-за формата хуже, чем подержать её лишнее время.
 */
export function isWithinRetention(lead: Pick<StoredLead, "createdAt">, nowMs: number): boolean {
  const createdMs = Date.parse(lead.createdAt);
  if (Number.isNaN(createdMs)) {
    return true;
  }
  const limit = new Date(nowMs);
  limit.setFullYear(limit.getFullYear() - LEAD_RETENTION_YEARS);
  return createdMs >= limit.getTime();
}

async function writeLeads(leads: StoredLead[]) {
  // Просроченные заявки уходят при каждой записи файла — отдельной задачи по расписанию нет.
  const now = Date.now();
  const kept = leads.filter((lead) => isWithinRetention(lead, now));
  // Пишем через временный файл: оборванная запись не оставит обрезанный JSON.
  const tmpFile = LEADS_FILE + ".tmp";
  await writeFile(tmpFile, JSON.stringify(kept.slice(0, 500), null, 2), "utf8");
  await rename(tmpFile, LEADS_FILE);

  if (kept.length < leads.length) {
    await recordDeletions(
      leads.filter((lead) => !isWithinRetention(lead, now)),
      "retention",
    );
  }
}

async function appendLead(lead: LeadRequest) {
  const storedLead: StoredLead = {
    ...lead,
    id: randomUUID(),
    createdAt: lead.createdAt ?? new Date().toISOString(),
  };

  await mkdir(path.dirname(LEADS_FILE), { recursive: true });

  let leads: StoredLead[] = [];

  try {
    const content = await readFile(LEADS_FILE, "utf8");
    const parsed = JSON.parse(content) as unknown;
    leads = Array.isArray(parsed) ? (parsed as StoredLead[]) : [];
  } catch (error) {
    // Отсутствие файла — нормальная ситуация при первой заявке. Но если файл есть и не
    // читается, начинать с пустого списка нельзя: так исчезает вся история заявок.
    // Повреждённый файл откладываем рядом, чтобы данные можно было достать руками.
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT") {
      await rename(LEADS_FILE, LEADS_FILE + ".corrupt-" + Date.now()).catch(() => {});
    }
    leads = [];
  }

  leads.unshift(storedLead);

  await writeLeads(leads);
}
