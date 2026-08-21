import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export type LeadRequest = {
  name: string;
  phone: string;
  source: string;
  ip?: string | null;
};

type StoredLead = LeadRequest & {
  createdAt: string;
};

const LEADS_FILE = path.join(process.cwd(), "data", "leads.json");

/**
 * Запись сериализуется. Без этого две заявки, пришедшие почти одновременно, успевали
 * прочитать файл до записи друг друга — и одна из них молча терялась.
 */
let writeChain: Promise<void> = Promise.resolve();

export async function saveLead(lead: LeadRequest) {
  const task = writeChain.then(
    () => appendLead(lead),
    () => appendLead(lead),
  );
  writeChain = task.catch(() => {});
  return task;
}

async function appendLead(lead: LeadRequest) {
  const storedLead: StoredLead = {
    ...lead,
    createdAt: new Date().toISOString(),
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

  // Пишем через временный файл: оборванная запись не оставит обрезанный JSON.
  const tmpFile = LEADS_FILE + ".tmp";
  await writeFile(tmpFile, JSON.stringify(leads.slice(0, 500), null, 2), "utf8");
  await rename(tmpFile, LEADS_FILE);
}
