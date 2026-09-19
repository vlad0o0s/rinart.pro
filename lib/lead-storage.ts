import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

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

async function writeLeads(leads: StoredLead[]) {
  // Пишем через временный файл: оборванная запись не оставит обрезанный JSON.
  const tmpFile = LEADS_FILE + ".tmp";
  await writeFile(tmpFile, JSON.stringify(leads.slice(0, 500), null, 2), "utf8");
  await rename(tmpFile, LEADS_FILE);
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
