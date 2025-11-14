import { ProjectContent, ProjectSeo } from "./project-repository";

type Fact = { label: string; value: string };

export function ensureStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function ensureFacts(value: unknown): Fact[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const { label, value: factValue } = item as { label?: unknown; value?: unknown };
      if (typeof label !== "string" || typeof factValue !== "string") {
        return null;
      }
      return { label, value: factValue };
    })
    .filter((item): item is Fact => Boolean(item));
}

export function normaliseNullable(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }
  return String(value);
}

function trimOrUndefined(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export function buildSeoPayload(seo: {
  title?: string | null;
  description?: string | null;
  keywords?: string[];
  ogImage?: string | null;
}): ProjectSeo | undefined {
  const title = trimOrUndefined(seo.title ?? undefined);
  const description = trimOrUndefined(seo.description ?? undefined);
  const keywords = (seo.keywords ?? []).map((keyword) => keyword.trim()).filter((keyword) => keyword.length > 0);
  const ogImage = trimOrUndefined(seo.ogImage ?? undefined);

  const payload: ProjectSeo = {};
  if (title) payload.title = title;
  if (description) payload.description = description;
  if (keywords.length) payload.keywords = keywords;
  if (ogImage) payload.ogImage = ogImage;

  return Object.keys(payload).length ? payload : undefined;
}

export function buildContent(
  descriptionBody: string[],
  facts: Fact[],
  seo?: ProjectSeo,
  descriptionHtml?: string,
): ProjectContent {
  const hasBody = descriptionBody.length > 0;
  const hasFacts = facts.length > 0;
  const hasSeo = Boolean(seo && Object.keys(seo).length);
  const trimmedHtml = (descriptionHtml ?? "").trim();
  const hasHtml = trimmedHtml.length > 0;

  if (!hasBody && !hasFacts && !hasSeo && !hasHtml) {
    return null;
  }

  const payload: NonNullable<ProjectContent> = {};
  if (hasBody) payload.body = descriptionBody;
  if (hasHtml) payload.bodyHtml = trimmedHtml;
  if (hasFacts) payload.facts = facts;
  if (hasSeo && seo) payload.seo = seo;
  return payload;
}
