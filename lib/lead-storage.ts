import { mkdir, readFile, writeFile } from "node:fs/promises";
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

export async function saveLead(lead: LeadRequest) {
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
  } catch {
    leads = [];
  }

  leads.unshift(storedLead);
  await writeFile(LEADS_FILE, JSON.stringify(leads.slice(0, 500), null, 2), "utf8");
}
