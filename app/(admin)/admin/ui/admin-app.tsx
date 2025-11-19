"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { SVGProps } from "react";
import type { ChangeEvent as ReactChangeEvent, FormEvent as ReactFormEvent, MouseEvent as ReactMouseEvent } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  DragOverlay,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core";
import Image from "next/image";
import { SafeImage, SafeImage as ModalImage } from "@/components/safe-image";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import styles from "./admin.module.css";

const CATEGORY_OPTIONS = [
  { id: "houses", label: "Частные дома" },
  { id: "interior", label: "Интерьеры" },
  { id: "art", label: "Арт объекты" },
  { id: "other", label: "Иные строения" },
] as const;

const PROJECTS_DND_ACCESSIBILITY = {
  describedById: "projects-sortable-instructions",
  screenReaderInstructions: {
    draggable: "Нажмите пробел, чтобы начать перетаскивание. Используйте стрелки для перемещения и пробел, чтобы закрепить позицию.",
  },
} as const;

const OPTIMIZED_EXTENSIONS = [".avif", ".webp"] as const;

const STORAGE_KEY_SELECTED_PROJECT = "rinart-admin-selected-project-slug";

function isOptimizedImageUrl(url: string | null | undefined): boolean {
  if (!url) {
    return false;
  }
  const clean = url.split("?")[0].toLowerCase();
  return OPTIMIZED_EXTENSIONS.some((ext) => clean.endsWith(ext));
}

function IconX(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

function IconTrash(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M9 10v8" />
      <path d="M15 10v8" />
      <path d="M5 6 6 20a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14" />
    </svg>
  );
}

function IconEraser(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="m20 20-9-9" />
      <path d="m16 20-9-9 5-5a2.828 2.828 0 0 1 4 0L21 11a2.828 2.828 0 0 1 0 4l-5 5Z" />
      <path d="M6 12 3 9" />
    </svg>
  );
}

function IconExternalLink(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

type ProjectSummary = {
  id: number;
  slug: string;
  title: string;
  tagline?: string | null;
  heroImageUrl?: string | null;
  categories: string[];
  order: number;
};

function getCategoryLabels(project: ProjectSummary): string[] {
  return project.categories.map(
    (category) => CATEGORY_OPTIONS.find((option) => option.id === category)?.label ?? category,
  );
}

type ProjectDetailResponse = {
  project: {
    id: number;
    slug: string;
    title: string;
    tagline: string | null;
    location: string | null;
    year: string | null;
    area: string | null;
    scope: string | null;
    intro: string | null;
    heroImageUrl: string | null;
    order: number;
    categories: string[] | null;
    content: {
      body?: string[];
      bodyHtml?: string;
      facts?: { label: string; value: string }[];
      seo?: {
        title?: string;
        description?: string;
        keywords?: string[];
        ogImage?: string;
      };
    } | null;
    media: {
      id: number;
      url: string;
      caption: string | null;
      kind: "FEATURE" | "GALLERY" | "SCHEME";
      order: number;
    }[];
    schemes: {
      id: number;
      title: string;
      url: string;
      order: number;
    }[];
  };
};

type GalleryItem = {
  id: string;
  url: string;
  caption: string;
};

type SchemeItem = {
  id: string;
  title: string;
  url: string;
};

type LibraryAssetResponse = {
  id: number;
  url: string;
  title: string | null;
};

type MediaAsset = {
  id: string;
  url: string;
  title: string;
  origin: "library" | "project";
};

type SeoPageDefaults = {
  title?: string | null;
  description?: string | null;
  keywords?: string[];
  ogImageUrl?: string | null;
};

type SeoPageResponse = {
  slug: string;
  label: string;
  path: string;
  defaults: SeoPageDefaults;
  seo: {
    title: string | null;
    description: string | null;
    keywords: string[];
    ogImageUrl: string | null;
  };
};

type SeoPageState = {
  slug: string;
  label: string;
  path: string;
  title: string;
  description: string;
  keywords: string;
  ogImageUrl: string;
  defaults: SeoPageDefaults;
};

type SeoEditorField = "title" | "description" | "keywords" | "ogImageUrl";

type MediaLibraryMode =
  | "hero"
  | "gallery-add"
  | "gallery-replace"
  | "scheme"
  | "seo"
  | "seo-page"
  | "team-image"
  | "team-mobile-image"
  | "site-hero"
  | "site-transition"
  | "contact-hero";

type MediaLibraryState = {
  open: boolean;
  mode: MediaLibraryMode;
  targetId?: string;
  initialSelection?: string[];
};

type ContactSettingsState = {
  heroTitle: string;
  phoneLabel: string;
  phoneHref: string;
  emailLabel: string;
  emailHref: string;
  locationLabel: string;
  heroImageUrl: string | null;
  footerTitle: string;
  cityLabel: string;
  whatsappLabel: string;
  whatsappUrl: string;
  backToTopLabel: string;
};

type SocialLinkState = {
  id: string;
  platform: SocialPlatformOption;
  label: string;
  url: string;
};

type SocialPlatformOption = "instagram" | "telegram" | "vk" | "pinterest";

type TeamMemberState = {
  id: number;
  name: string;
  role: string;
  label: string;
  imageUrl: string;
  mobileImageUrl: string;
  isFeatured: boolean;
  order: number;
};

type TeamEditorState = TeamMemberState | null;

const CONTACT_DEFAULTS: ContactSettingsState = {
  heroTitle: "Контактная информация",
  phoneLabel: "+7 903 147-44-30",
  phoneHref: "tel:+79031474430",
  emailLabel: "rinartburo@mail.ru",
  emailHref: "mailto:rinartburo@mail.ru",
  locationLabel: "Москва, Российская Федерация",
  heroImageUrl: "/img/group-1005.webp",
  footerTitle: "Обсудим ваш проект:",
  cityLabel: "г. Москва",
  whatsappLabel: "Написать в WhatsApp",
  whatsappUrl: "https://wa.me/79031474430",
  backToTopLabel: "В начало",
};

type AppearanceSettingsState = {
  homeHeroImageUrl: string;
  transitionImageUrl: string;
};

const APPEARANCE_DEFAULTS: AppearanceSettingsState = {
  homeHeroImageUrl: "/img/01-ilichevka.jpg",
  transitionImageUrl:
    "https://cdn.prod.website-files.com/66bb7b4fa99c404bd3587d90/66bb7c2f116c8e6c95b73391_Logo_Preloader.png",
};

type SettingsTab = "contacts" | "social" | "media" | "team";

const SETTINGS_TABS: { id: SettingsTab; label: string; description: string }[] = [
  { id: "contacts", label: "Контакты", description: "Телефон, email, адрес и изображение" },
  { id: "social", label: "Социальные сети", description: "Ссылки для шапки, подвала и контактов" },
  { id: "media", label: "Медиа сайта", description: "Изображения главного экрана и переходов" },
  { id: "team", label: "Команда", description: "Карточки участников мастерской" },
];

const SOCIAL_PLATFORM_OPTIONS: { label: string; value: SocialPlatformOption }[] = [
  { label: "Instagram", value: "instagram" },
  { label: "Telegram", value: "telegram" },
  { label: "VK", value: "vk" },
  { label: "Pinterest", value: "pinterest" },
];

const SOCIAL_DEFAULTS: SocialLinkState[] = [
  { id: "instagram", platform: "instagram", label: "INST: rinart.buro", url: "https://www.instagram.com/rinart.buro/" },
  { id: "telegram", platform: "telegram", label: "TG: rinart_buro", url: "https://t.me/rinart_buro" },
  { id: "vk", platform: "vk", label: "VK: rinart_buro", url: "https://vk.com/rinart_buro" },
  { id: "pinterest", platform: "pinterest", label: "Pinterest: rinartburo", url: "https://www.pinterest.com/rinartburo" },
];

function toTelHref(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const digits = trimmed.replace(/[^+\d]/g, "");
  if (!digits) {
    return "";
  }
  return `tel:${digits.replace(/^tel:/i, "")}`;
}

function toMailHref(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const clean = trimmed.replace(/^mailto:/i, "");
  if (!clean) {
    return "";
  }
  return `mailto:${clean}`;
}

function normalizeContactSettings(value?: Partial<ContactSettingsState> | null): ContactSettingsState {
  if (!value) {
    return CONTACT_DEFAULTS;
  }
  return {
    heroTitle: value.heroTitle?.trim() || CONTACT_DEFAULTS.heroTitle,
    phoneLabel: value.phoneLabel?.trim() || CONTACT_DEFAULTS.phoneLabel,
    phoneHref: value.phoneHref?.trim() || CONTACT_DEFAULTS.phoneHref,
    emailLabel: value.emailLabel?.trim() || CONTACT_DEFAULTS.emailLabel,
    emailHref: value.emailHref?.trim() || CONTACT_DEFAULTS.emailHref,
    locationLabel: value.locationLabel?.trim() || CONTACT_DEFAULTS.locationLabel,
    heroImageUrl: value.heroImageUrl?.trim() || CONTACT_DEFAULTS.heroImageUrl,
    footerTitle: value.footerTitle?.trim() || CONTACT_DEFAULTS.footerTitle,
    cityLabel: value.cityLabel?.trim() || CONTACT_DEFAULTS.cityLabel,
    whatsappLabel: value.whatsappLabel?.trim() || CONTACT_DEFAULTS.whatsappLabel,
    whatsappUrl: value.whatsappUrl?.trim() || CONTACT_DEFAULTS.whatsappUrl,
    backToTopLabel: value.backToTopLabel?.trim() || CONTACT_DEFAULTS.backToTopLabel,
  };
}

function normalizeSocialLinks(links?: unknown): SocialLinkState[] {
  if (!Array.isArray(links)) {
    return SOCIAL_DEFAULTS;
  }
  const normalized = links
    .map((link) => {
      if (!link || typeof link !== "object") {
        return null;
      }
      const source = link as Partial<SocialLinkState>;
      const platform = SOCIAL_PLATFORM_OPTIONS.find((option) => option.value === source.platform)?.value ?? "instagram";
      const id = typeof source.id === "string" && source.id.trim().length > 0 ? source.id.trim() : platform;
      const label = typeof source.label === "string" && source.label.trim().length > 0 ? source.label.trim() : platform;
      const url = typeof source.url === "string" && source.url.trim().length > 0 ? source.url.trim() : "";
      if (!url) {
        return null;
      }
      return { id, platform, label, url };
    })
    .filter((link): link is SocialLinkState => Boolean(link));
  return normalized.length ? normalized : SOCIAL_DEFAULTS;
}

function normalizeTeamMember(member: Partial<TeamMemberState> | null | undefined): TeamMemberState {
  return {
    id: Number(member?.id) || 0,
    name: typeof member?.name === "string" ? member.name : "",
    role: typeof member?.role === "string" ? member.role : "",
    label: typeof member?.label === "string" ? member.label : "",
    imageUrl: typeof member?.imageUrl === "string" ? member.imageUrl : "",
    mobileImageUrl: typeof member?.mobileImageUrl === "string" ? member.mobileImageUrl : "",
    isFeatured: Boolean(member?.isFeatured),
    order: Number(member?.order) || 0,
  };
}

type EditorState = {
  slug: string;
  title: string;
  descriptionHtml: string;
  categories: string[];
  heroImageUrl: string;
  gallery: GalleryItem[];
  schemes: SchemeItem[];
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  seoOgImageUrl: string;
};

type EditorFieldChangeHandler = <K extends keyof EditorState>(field: K, value: EditorState[K]) => void;

function convertBodyToHtml(body: string[]): string {
  if (!body || !body.length) return "";
  return body.map((paragraph) => `<p>${paragraph.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`).join("\n");
}

function convertHtmlToParagraphs(html: string): string[] {
  const container = document.createElement("div");
  container.innerHTML = html;
  const selectors = ["p", "h1", "h2", "h3", "h4", "li"];
  return Array.from(container.querySelectorAll(selectors.join(",")))
    .map((p) => p.textContent?.trim() ?? "")
    .filter(Boolean);
}

/* function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripHtml(value: string): string {
  return value.replace(/<\/?[^>]+(>|$)/g, "").replace(/\s+/g, " ").trim();
} */

function mapProjectToEditor(project: ProjectDetailResponse["project"]): EditorState {
  const feature = project.media.find((media) => media.kind === "FEATURE" && isOptimizedImageUrl(media.url));
  const gallery = project.media
    .filter((media) => media.kind === "GALLERY" && isOptimizedImageUrl(media.url))
    .sort((a, b) => a.order - b.order)
    .map((media, index) => ({
      id: `${project.slug}-gallery-${media.id ?? index}`,
      url: media.url,
      caption: media.caption ?? "",
    }));

  const schemes = project.schemes
    .sort((a, b) => a.order - b.order)
    .map((scheme, index) => ({
      id: `${project.slug}-scheme-${scheme.id ?? index}`,
      title: scheme.title,
      url: scheme.url,
    }))
    .filter((scheme) => isOptimizedImageUrl(scheme.url));

  const body = project.content?.body ?? [];
  const html = project.content?.bodyHtml ?? convertBodyToHtml(body);
  const seo = project.content?.seo;
  const seoTitle = typeof seo?.title === "string" ? seo.title : "";
  const seoDescription = typeof seo?.description === "string" ? seo.description : "";
  const seoKeywordsArray = Array.isArray(seo?.keywords)
    ? seo.keywords.filter((item: unknown): item is string => typeof item === "string")
    : [];
  const seoKeywords = seoKeywordsArray.join(", ");
  const seoOgImageUrl = typeof seo?.ogImage === "string" ? seo.ogImage : "";

  return {
    slug: project.slug,
    title: project.title,
    descriptionHtml: html,
    categories: (project.categories ?? []) as string[],
    heroImageUrl:
      (project.heroImageUrl && isOptimizedImageUrl(project.heroImageUrl)
        ? project.heroImageUrl
        : feature?.url ?? "") ?? "",
    gallery,
    schemes,
    seoTitle,
    seoDescription,
    seoKeywords,
    seoOgImageUrl,
  };
}

function generateId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function createMediaAsset(
  url: string,
  title?: string,
  origin: MediaAsset["origin"] = "project",
  customId?: string,
): MediaAsset {
  const cleanUrl = url.trim();
  const cleanTitle = title?.trim() || "Изображение";
  return {
    id: customId ?? generateId(origin === "library" ? "library" : "asset"),
    url: cleanUrl,
    title: cleanTitle,
    origin,
  };
}

function collectAssetsFromProjects(projects: ProjectDetailResponse["project"][]): MediaAsset[] {
  const assets: MediaAsset[] = [];
  projects.forEach((project) => {
    if (project.heroImageUrl && isOptimizedImageUrl(project.heroImageUrl)) {
      assets.push(createMediaAsset(project.heroImageUrl, project.title, "project"));
    }
    project.media.forEach((item) => {
      if (item.url && isOptimizedImageUrl(item.url)) {
        assets.push(createMediaAsset(item.url, item.caption ?? project.title, "project"));
      }
    });
    project.schemes.forEach((scheme) => {
      if (scheme.url && isOptimizedImageUrl(scheme.url)) {
        assets.push(createMediaAsset(scheme.url, scheme.title, "project"));
      }
    });
    const ogImage = project.content?.seo?.ogImage;
    if (ogImage && ogImage.trim().length > 0 && isOptimizedImageUrl(ogImage)) {
      assets.push(createMediaAsset(ogImage, `${project.title} — превью`, "project"));
    }
  });
  return assets;
}

function collectAssetsFromEditor(state: EditorState): MediaAsset[] {
  const assets: MediaAsset[] = [];
  if (state.heroImageUrl && isOptimizedImageUrl(state.heroImageUrl)) {
    assets.push(createMediaAsset(state.heroImageUrl, state.title, "project"));
  }
  state.gallery.forEach((item) => {
    if (item.url && isOptimizedImageUrl(item.url)) {
      assets.push(createMediaAsset(item.url, item.caption, "project"));
    }
  });
  if (state.seoOgImageUrl && isOptimizedImageUrl(state.seoOgImageUrl)) {
    const clean = state.seoOgImageUrl.trim();
    if (clean) {
      assets.push(createMediaAsset(clean, `${state.title} — превью`, "project"));
    }
  }
  return assets;
}

const CYRILLIC_MAP: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

function slugifyTitle(input: string): string {
  if (!input) return "";
  const lower = input.toLowerCase();
  let result = "";
  for (const char of lower) {
    if (CYRILLIC_MAP[char]) {
      result += CYRILLIC_MAP[char];
      continue;
    }
    if (/[a-z0-9]/.test(char)) {
      result += char;
      continue;
    }
    if (/\s|[_\-./]/.test(char)) {
      result += "-";
    }
  }
  result = result.replace(/-+/g, "-").replace(/^-|-$/g, "");
  return result;
}

function ensureUniqueSlug(base: string, existing: Set<string>): string {
  const normalized = base || "project";
  if (!existing.has(normalized)) {
    return normalized;
  }
  let counter = 2;
  let candidate = `${normalized}-${counter}`;
  while (existing.has(candidate)) {
    counter += 1;
    candidate = `${normalized}-${counter}`;
  }
  return candidate;
}

function isSlugConflictError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message ?? "";
  try {
    const parsed = JSON.parse(message);
    if (typeof parsed?.error === "string") {
      return parsed.error.toLowerCase().includes("slug");
    }
  } catch {
    // ignore JSON parse errors
  }
  return message.toLowerCase().includes("slug");
}

function looksLikeUrl(value: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function mergeMediaAssets(current: MediaAsset[], incoming: MediaAsset[]): MediaAsset[] {
  if (!incoming.length) {
    return current.filter((asset) => isOptimizedImageUrl(asset.url));
  }
  const map = new Map<string, MediaAsset>();
  current.forEach((asset) => {
    if (isOptimizedImageUrl(asset.url)) {
      map.set(asset.url, asset);
    }
  });
  const prepend: MediaAsset[] = [];
  incoming.forEach((asset) => {
    if (!isOptimizedImageUrl(asset.url)) {
      return;
    }
    const existing = map.get(asset.url);
    if (!existing) {
      map.set(asset.url, asset);
      if (asset.origin === "library") {
        prepend.push(asset);
      }
      return;
    }

    if (existing.origin === "project" && asset.origin === "library") {
      map.set(asset.url, { ...existing, ...asset, origin: "library" });
      return;
    }

    if (!existing.title && asset.title) {
      map.set(asset.url, { ...existing, title: asset.title });
    }
  });
  if (!prepend.length) {
    return Array.from(map.values());
  }
  const prependUrls = new Set(prepend.map((asset) => asset.url));
  const rest = Array.from(map.values()).filter((asset) => !prependUrls.has(asset.url));
  return [...prepend, ...rest];
}

function splitKeywordsInput(value: string): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0);
}

class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new UnauthorizedError();
    }
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }

  return response.json();
}

function SortableProjectItem({
  project,
  index,
  isActive,
  onSelect,
  onDelete,
}: {
  project: ProjectSummary;
  index: number;
  isActive: boolean;
  onSelect: (slug: string) => void;
  onDelete: (slug: string) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: project.slug,
  });
  const { onPointerDown: sortablePointerDown, ...otherListeners } = listeners ?? {};

  const animationDelay = `${Math.min(index, 10) * 50}ms`;
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
    animationDelay: isDragging ? undefined : animationDelay,
  };

  const categoryLabels = getCategoryLabels(project);
  return (
    <article
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`${styles.projectListItem} ${styles.fadeInItem}`}
      data-active={isActive}
      data-dragging={isDragging}
      onClick={() => onSelect(project.slug)}
    >
      <div className={styles.projectRow}>
        <button
          className={styles.dragHandle}
          type="button"
          aria-label={`Перетащить проект ${project.title}`}
          ref={setActivatorNodeRef}
          {...otherListeners}
          onPointerDown={(event) => {
            sortablePointerDown?.(event);
            if (!event.defaultPrevented) {
              event.stopPropagation();
            }
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <span className={styles.dragIcon} aria-hidden="true" />
        </button>
        <div className={styles.projectMeta}>
          <div className={styles.projectTitleRow}>
            <span className={styles.projectOrder}>{String(index + 1).padStart(2, "0")}</span>
            <h4 className={styles.projectListTitle}>{project.title}</h4>
          </div>
          {project.tagline ? <p className={styles.projectListMeta}>{project.tagline}</p> : null}
          {categoryLabels.length ? (
            <div className={styles.projectTags}>
              {categoryLabels.map((label) => (
                <span key={`${project.slug}-${label}`} className={styles.projectTag}>
                  {label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className={styles.projectDelete}
          aria-label={`Удалить проект ${project.title}`}
          data-visible={isActive ? "static" : "hover"}
          onClick={(event) => {
            event.stopPropagation();
            onDelete(project.slug);
          }}
        >
          <IconTrash aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

function ProjectListCard({
  project,
  index,
  isActive,
  onSelect,
  onDelete,
  animated = true,
}: {
  project: ProjectSummary;
  index: number;
  isActive: boolean;
  onSelect: (slug: string) => void;
  onDelete: (slug: string) => void;
  animated?: boolean;
}) {
  const cardStyle: React.CSSProperties = animated
    ? { animationDelay: `${Math.min(index, 10) * 50}ms` }
    : { animation: "none" };
  const categoryLabels = getCategoryLabels(project);
  return (
    <article
      className={`${styles.projectListItem} ${styles.fadeInItem}`}
      data-active={isActive}
      onClick={() => onSelect(project.slug)}
      style={cardStyle}
    >
      <div className={styles.projectRow}>
        <div className={`${styles.dragHandle} ${styles.dragHandleStatic}`}>
          <span className={styles.dragIcon} aria-hidden="true" />
        </div>
        <div className={styles.projectMeta}>
          <div className={styles.projectTitleRow}>
            <span className={styles.projectOrder}>{String(index + 1).padStart(2, "0")}</span>
            <h4 className={styles.projectListTitle}>{project.title}</h4>
          </div>
          {project.tagline ? <p className={styles.projectListMeta}>{project.tagline}</p> : null}
          {categoryLabels.length ? (
            <div className={styles.projectTags}>
              {categoryLabels.map((label) => (
                <span key={`${project.slug}-${label}`} className={styles.projectTag}>
                  {label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className={styles.projectDelete}
          aria-label={`Удалить проект ${project.title}`}
          data-visible={isActive ? "static" : "hover"}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDelete(project.slug);
          }}
        >
          <IconTrash aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

function ProjectListSkeleton() {
  return (
    <div className={styles.projectSkeletonList}>
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={`project-skeleton-${index}`} className={styles.projectSkeletonCard}>
          <div className={styles.projectSkeletonHeader}>
            <span className={`${styles.skeleton} ${styles.skeletonBadge}`} />
            <span className={`${styles.skeleton} ${styles.skeletonLine}`} />
          </div>
          <span className={`${styles.skeleton} ${styles.skeletonLineShort}`} />
          <div className={styles.projectSkeletonTags}>
            {Array.from({ length: 3 }).map((_, tagIndex) => (
              <span
                key={`project-skeleton-tag-${index}-${tagIndex}`}
                className={`${styles.skeleton} ${styles.skeletonTag}`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EditorSkeleton() {
  return (
    <div className={styles.editorSkeleton}>
      <div className={styles.editorSkeletonSection}>
        <span className={`${styles.skeleton} ${styles.skeletonLine}`} />
        <span className={`${styles.skeleton} ${styles.skeletonLineShort}`} />
      </div>
      <div className={styles.editorSkeletonSection}>
        <span className={`${styles.skeleton} ${styles.skeletonLine}`} />
        <div className={styles.editorSkeletonToolbar}>
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={`editor-toolbar-${index}`} className={`${styles.skeleton} ${styles.editorSkeletonButton}`} />
          ))}
        </div>
        <div className={styles.editorSkeletonGrid}>
          {Array.from({ length: 4 }).map((_, index) => (
            <span key={`editor-grid-${index}`} className={`${styles.skeleton} ${styles.skeletonLine}`} />
          ))}
        </div>
      </div>
      <div className={styles.editorSkeletonSection}>
        <span className={`${styles.skeleton} ${styles.skeletonLine}`} />
        <span className={`${styles.skeleton} ${styles.skeletonLineShort}`} />
        <span className={`${styles.skeleton} ${styles.skeletonLine}`} style={{ height: 180 }} />
      </div>
    </div>
  );
}

function MediaPanelSkeleton() {
  return (
    <div className={styles.mediaSkeleton}>
      <div>
        <span className={`${styles.skeleton} ${styles.skeletonLine}`} />
        <div className={`${styles.skeleton} ${styles.skeletonHero}`} style={{ marginTop: 14 }} />
      </div>
      <div>
        <span className={`${styles.skeleton} ${styles.skeletonLine}`} />
        <div className={styles.mediaSkeletonGallery}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`media-skeleton-${index}`} className={styles.mediaSkeletonCard}>
              <span className={`${styles.skeleton} ${styles.skeletonThumb}`} />
              <span className={`${styles.skeleton} ${styles.skeletonLineShort}`} />
            </div>
          ))}
        </div>
      </div>
      <div className={styles.editorSkeletonSection} style={{ borderBottom: "none", paddingBottom: 0 }}>
        <span className={`${styles.skeleton} ${styles.skeletonLine}`} />
        <div className={styles.editorSkeletonToolbar}>
          {Array.from({ length: 3 }).map((_, index) => (
            <span key={`media-button-${index}`} className={`${styles.skeleton} ${styles.editorSkeletonButton}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MediaLibraryItemSkeleton() {
  return (
    <div className={styles.mediaModalItem}>
      <div className={styles.mediaModalSelectable} style={{ cursor: "default", pointerEvents: "none" }}>
        <div className={styles.mediaModalPreview}>
          <div className={`${styles.skeleton} ${styles.skeletonThumb}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", borderRadius: "8px" }} />
        </div>
        <span className={`${styles.skeleton} ${styles.skeletonLineShort}`} style={{ marginTop: "8px", height: "16px", width: "80%" }} />
      </div>
    </div>
  );
}

function SortableGalleryItem({
  item,
  index,
  onRemove,
  onReplace,
}: {
  item: GalleryItem;
  index: number;
  onRemove: (id: string) => void;
  onReplace: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const { onPointerDown: sortablePointerDown, ...otherListeners } = listeners ?? {};
  const [justEndedDrag, setJustEndedDrag] = useState(false);

  // Отслеживаем завершение drag для предотвращения горизонтального "прыжка"
  useEffect(() => {
    if (isDragging) {
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setJustEndedDrag(false);
      }, 0);
    } else {
      // Когда drag только что завершился - сразу сбрасываем transform без transition
      if (transform && (transform.x !== 0 || transform.scaleX !== 1)) {
        // Use setTimeout to avoid synchronous setState in effect
        setTimeout(() => {
          setJustEndedDrag(true);
          // Используем requestAnimationFrame для синхронизации с рендером браузера
          requestAnimationFrame(() => {
            setJustEndedDrag(false);
          });
        }, 0);
      }
    }
  }, [isDragging, transform]);

  // Принудительно обнуляем x координату и scaleX в transform для предотвращения горизонтального смещения
  const verticalTransform = transform 
    ? { ...transform, x: 0, scaleX: 1 } 
    : null;

  // Когда drag только что завершился, полностью сбрасываем transform и отключаем transition
  const shouldResetTransform = justEndedDrag;

  const style: React.CSSProperties = {
    transform: shouldResetTransform 
      ? undefined 
      : verticalTransform 
        ? CSS.Transform.toString(verticalTransform) 
        : undefined,
    transition: shouldResetTransform ? 'none' : transition,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      className={styles.galleryThumb}
      style={style}
      {...attributes}
      data-dragging={isDragging}
    >
      <button
        className={styles.dragHandle}
        type="button"
        aria-label={`Перетащить изображение ${index + 1}`}
        ref={setActivatorNodeRef}
        {...otherListeners}
        onPointerDown={(event) => {
          sortablePointerDown?.(event);
          if (!event.defaultPrevented) {
            event.stopPropagation();
          }
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <span className={styles.dragIcon} aria-hidden="true" />
      </button>
      <button
        className={styles.galleryThumbButton}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onReplace(item.id);
        }}
        aria-label="Заменить изображение из галереи"
      >
        {item.url ? (
          <SafeImage
            src={item.url}
            alt={item.caption || "Изображение галереи"}
            width={320}
            height={200}
          />
        ) : (
          <span className={styles.galleryThumbPlaceholder}>Изображение не выбрано</span>
        )}
      </button>
      <button
        className={styles.previewDeleteButton}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onRemove(item.id);
        }}
        aria-label="Удалить изображение из галереи"
      >
        <IconX aria-hidden="true" />
      </button>
    </div>
  );
}

function GalleryItemCard({ item }: { item: GalleryItem; index: number }) {
  return (
    <div className={styles.galleryThumb}>
      <button
        className={styles.previewDeleteButton}
        type="button"
        aria-label="Удалить изображение из галереи"
      >
        <IconX aria-hidden="true" />
      </button>
      <button
        className={styles.galleryThumbButton}
        type="button"
        aria-label="Заменить изображение из галереи"
      >
        {item.url ? (
          <SafeImage
            src={item.url}
            alt={item.caption || "Изображение галереи"}
            width={320}
            height={200}
          />
        ) : (
          <span className={styles.galleryThumbPlaceholder}>Изображение не выбрано</span>
        )}
      </button>
    </div>
  );
}

export function AdminApp({ initialProjects }: { initialProjects: ProjectSummary[] }) {
  const [projects, setProjects] = useState<ProjectSummary[]>(initialProjects);
  
  // Восстанавливаем выбранный проект из localStorage
  const getInitialSelectedSlug = useCallback((): string | null => {
    if (typeof window === "undefined") {
      return initialProjects[0]?.slug ?? null;
    }
    try {
      const savedSlug = localStorage.getItem(STORAGE_KEY_SELECTED_PROJECT);
      if (savedSlug && initialProjects.some((p) => p.slug === savedSlug)) {
        return savedSlug;
      }
    } catch {
      // Игнорируем ошибки localStorage
    }
    return initialProjects[0]?.slug ?? null;
  }, [initialProjects]);

  const [selectedSlug, setSelectedSlug] = useState<string | null>(getInitialSelectedSlug);
  const selectedSlugRef = useRef<string | null>(selectedSlug);
  
  useEffect(() => {
    selectedSlugRef.current = selectedSlug;
  }, [selectedSlug]);

  // Сохраняем выбранный проект в localStorage при изменении
  useEffect(() => {
    if (typeof window === "undefined" || !selectedSlug) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY_SELECTED_PROJECT, selectedSlug);
    } catch {
      // Игнорируем ошибки localStorage
    }
  }, [selectedSlug]);

  // Проверяем, что выбранный проект все еще существует в списке проектов
  useEffect(() => {
    if (!selectedSlug || projects.length === 0) {
      return;
    }
    const projectExists = projects.some((p) => p.slug === selectedSlug);
    if (!projectExists) {
      // Если выбранный проект больше не существует, выбираем первый доступный
      const firstSlug = projects[0]?.slug ?? null;
      setSelectedSlug(firstSlug);
      if (firstSlug) {
        try {
          localStorage.setItem(STORAGE_KEY_SELECTED_PROJECT, firstSlug);
        } catch {
          // Игнорируем ошибки localStorage
        }
      }
    }
  }, [projects, selectedSlug]);
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [mediaSaving, setMediaSaving] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [editorLoading, setEditorLoading] = useState(false);
  const [libraryAssets, setLibraryAssets] = useState<MediaAsset[]>([]);
  const [mediaLibrary, setMediaLibrary] = useState<MediaLibraryState>({ open: false, mode: "hero", initialSelection: [] });
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [galleryActiveDragId, setGalleryActiveDragId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const deleteLibraryAsset = async (asset: MediaAsset) => {
    if (asset.origin !== "library") {
      return;
    }
    const idPart = asset.id.startsWith("library-") ? asset.id.slice("library-".length) : "";
    const dbId = Number(idPart);
    if (!dbId) {
      return;
    }
    await fetchJson<{ ok: boolean }>(
      "/api/admin/media/library",
      {
        method: "DELETE",
        body: JSON.stringify({ id: dbId, url: asset.url }),
      },
    );
    setLibraryAssets((prev) => prev.filter((item) => item.id !== asset.id));
  };
  const [activeView, setActiveView] = useState<"projects" | "seo" | "content" | "settings">("projects");

  // Content (site-wide) state
  type ContentItemState = { slug: "home-hero" | "page-transition" | "contacts"; title: string; imageUrl: string | null; locationLabel?: string | null };
  const [contentItems, setContentItems] = useState<ContentItemState[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentSaving, setContentSaving] = useState(false);
  const [selectedContentSlug, setSelectedContentSlug] = useState<ContentItemState["slug"] | null>(null);
  const selectedContent = useMemo(
    () => (selectedContentSlug ? contentItems.find((i) => i.slug === selectedContentSlug) ?? null : null),
    [contentItems, selectedContentSlug],
  );
  const [contentSocialLinks, setContentSocialLinks] = useState<SocialLinkState[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialSaving, setSocialSaving] = useState(false);
  const [selectedSocialId, setSelectedSocialId] = useState<string | null>(null);
  const [publications, setPublications] = useState<string[]>([]);
  const [publicationsLoading, setPublicationsLoading] = useState(false);
  const [publicationsSaving, setPublicationsSaving] = useState(false);
  const selectedSocial = useMemo(
    () => (selectedSocialId ? contentSocialLinks.find((l) => l.id === selectedSocialId) ?? null : null),
    [contentSocialLinks, selectedSocialId],
  );
  const [seoPages, setSeoPages] = useState<SeoPageState[]>([]);
  const [selectedSeoSlug, setSelectedSeoSlug] = useState<string | null>(null);
  const [seoLoading, setSeoLoading] = useState(false);
  const [seoSavingSlug, setSeoSavingSlug] = useState<string | null>(null);
  const [contactSettings, setContactSettings] = useState<ContactSettingsState>(CONTACT_DEFAULTS);
  const [socialLinks, setSocialLinks] = useState<SocialLinkState[]>(SOCIAL_DEFAULTS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [appearanceSettings, setAppearanceSettings] = useState<AppearanceSettingsState>(APPEARANCE_DEFAULTS);
  const [appearanceLoaded, setAppearanceLoaded] = useState(false);
  const [appearanceLoading, setAppearanceLoading] = useState(false);
  const [appearanceSaving, setAppearanceSaving] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMemberState[]>([]);
  const [teamLoaded, setTeamLoaded] = useState(false);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamSelectedId, setTeamSelectedId] = useState<number | null>(null);
  const [teamEditor, setTeamEditor] = useState<TeamEditorState>(null);
  const [teamSaving, setTeamSaving] = useState(false);
  const [teamDeleting, setTeamDeleting] = useState(false);
  const [teamActiveDragId, setTeamActiveDragId] = useState<number | null>(null);
  const [teamCreateModalOpen, setTeamCreateModalOpen] = useState(false);
  const activeProject = useMemo(
    () => (activeDragId ? projects.find((project) => project.slug === activeDragId) ?? null : null),
    [projects, activeDragId],
  );
  const existingSlugSet = useMemo(() => new Set(projects.map((project) => project.slug)), [projects]);
  const showProjectSkeleton = loading && projects.length === 0;
  const showEditorSkeleton = (loading && !editorState) || editorLoading || mediaSaving;
  const selectedSeoPage = useMemo(
    () => (selectedSeoSlug ? seoPages.find((page) => page.slug === selectedSeoSlug) ?? null : null),
    [seoPages, selectedSeoSlug],
  );
  const showSeoSkeleton = seoLoading && !seoPages.length;
  const seoSaving = selectedSeoSlug ? seoSavingSlug === selectedSeoSlug : false;
  const activeTeamMember = useMemo(
    () => (teamActiveDragId ? teamMembers.find((member) => member.id === teamActiveDragId) ?? null : null),
    [teamMembers, teamActiveDragId],
  );

  const redirectToLogin = useCallback(() => {
    window.location.href = "/admin/login";
  }, []);

  const reportError = useCallback(
    (error: unknown, fallbackMessage: string) => {
      if (error instanceof UnauthorizedError) {
        redirectToLogin();
        return;
      }
      console.error(error);
      if (error instanceof Error && error.message) {
        setStatus(error.message);
      } else {
        setStatus(fallbackMessage);
      }
    },
    [redirectToLogin],
  );

  const loadContactSettings = useCallback(async () => {
    try {
      setSettingsLoading(true);
      const data = await fetchJson<{ contact: Partial<ContactSettingsState>; socials: SocialLinkState[] }>(
        "/api/admin/settings/contact",
      );
      setContactSettings(normalizeContactSettings(data.contact));
      setSocialLinks(normalizeSocialLinks(data.socials));
      setSettingsLoaded(true);
    } catch (error) {
      reportError(error, "Не удалось загрузить настройки");
    } finally {
      setSettingsLoading(false);
    }
  }, [reportError]);

  const loadAppearanceSettings = useCallback(async () => {
    try {
      setAppearanceLoading(true);
      const data = await fetchJson<{ blocks: { ["home-hero"]?: { imageUrl?: string }; ["page-transition"]?: { imageUrl?: string } } }>(
        "/api/admin/settings/global-blocks",
      );
      setAppearanceSettings({
        homeHeroImageUrl: data.blocks?.["home-hero"]?.imageUrl ?? APPEARANCE_DEFAULTS.homeHeroImageUrl,
        transitionImageUrl: data.blocks?.["page-transition"]?.imageUrl ?? APPEARANCE_DEFAULTS.transitionImageUrl,
      });
      setAppearanceLoaded(true);
    } catch (error) {
      reportError(error, "Не удалось загрузить изображения");
    } finally {
      setAppearanceLoading(false);
    }
  }, [reportError]);

  const loadTeamMembers = useCallback(async () => {
    try {
      setTeamLoading(true);
      const data = await fetchJson<{ members: TeamMemberState[] }>("/api/admin/team");
      const normalized = (data.members ?? [])
        .map((member) => normalizeTeamMember(member))
        .sort((a, b) => a.order - b.order)
        .map((member, index) => ({ ...member, order: index }));
      setTeamMembers(normalized);
      setTeamSelectedId((prev) => prev ?? normalized[0]?.id ?? null);
      setTeamEditor((prev) => prev ?? normalized[0] ?? null);
      setTeamLoaded(true);
    } catch (error) {
      reportError(error, "Не удалось загрузить команду");
    } finally {
      setTeamLoading(false);
    }
  }, [reportError]);

  // Ensure team is loaded when opening Settings view with team tab
  useEffect(() => {
    if (activeView === "settings" && !teamLoaded && !teamLoading) {
      loadTeamMembers();
    }
  }, [activeView, teamLoaded, teamLoading, loadTeamMembers]);

  const handleContactFieldChange = useCallback(<K extends keyof ContactSettingsState>(field: K, value: string) => {
    setContactSettings((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "phoneLabel") {
        next.phoneHref = toTelHref(value);
      }
      if (field === "emailLabel") {
        next.emailHref = toMailHref(value);
      }
      return next;
    });
  }, []);

  const handleSocialFieldChange = useCallback(
    (id: string, field: keyof SocialLinkState, value: string | SocialPlatformOption) => {
      setSocialLinks((prev) =>
        prev.map((link) =>
          link.id === id
            ? {
                ...link,
                [field]: field === "platform" ? (value as SocialPlatformOption) : (value as string),
              }
            : link,
        ),
      );
    },
    [],
  );

  const handleSaveSettings = useCallback(async () => {
    try {
      setSettingsSaving(true);
      const sanitizedSocials = socialLinks
        .map((link) => ({
          ...link,
          url: link.url.trim(),
          label: link.label.trim(),
        }))
        .filter((link) => link.url.length > 0);
      const response = await fetchJson<{ contact: ContactSettingsState; socials: SocialLinkState[] }>(
        "/api/admin/settings/contact",
        {
          method: "PUT",
          body: JSON.stringify({
            contact: contactSettings,
            socials: sanitizedSocials,
          }),
        },
      );
      setContactSettings(normalizeContactSettings(response.contact));
      setSocialLinks(normalizeSocialLinks(response.socials));
      setStatus("Настройки сохранены");
    } catch (error) {
      reportError(error, "Не удалось сохранить настройки");
    } finally {
      setSettingsSaving(false);
    }
  }, [contactSettings, reportError, socialLinks]);

  const handleSaveSocials = useCallback(async () => {
    try {
      setSettingsSaving(true);
      const sanitizedSocials = socialLinks
        .map((link) => ({
          ...link,
          url: link.url.trim(),
          label: link.label.trim(),
        }))
        .filter((link) => link.url.length > 0);
      const response = await fetchJson<{ contact: ContactSettingsState; socials: SocialLinkState[] }>(
        "/api/admin/settings/contact",
        {
          method: "PUT",
          body: JSON.stringify({
            contact: contactSettings,
            socials: sanitizedSocials,
          }),
        },
      );
      setContactSettings(normalizeContactSettings(response.contact));
      setSocialLinks(normalizeSocialLinks(response.socials));
      setStatus("Социальные сети и телефон обновлены");
    } catch (error) {
      reportError(error, "Не удалось сохранить социальные сети");
    } finally {
      setSettingsSaving(false);
    }
  }, [contactSettings, reportError, socialLinks]);

  const handleAppearanceFieldChange = useCallback((field: keyof AppearanceSettingsState, value: string) => {
    setAppearanceSettings((prev) => ({ ...prev, [field]: value }));
  }, []);

  const persistAppearance = useCallback(
    async (next: AppearanceSettingsState) => {
      try {
        setAppearanceSaving(true);
        const payload = await fetchJson<{ blocks: { ["home-hero"]?: { imageUrl?: string }; ["page-transition"]?: { imageUrl?: string } } }>(
          "/api/admin/settings/global-blocks",
          {
            method: "PUT",
            body: JSON.stringify({
              blocks: {
                "home-hero": { imageUrl: next.homeHeroImageUrl ?? null },
                "page-transition": { imageUrl: next.transitionImageUrl ?? null },
              },
            }),
          },
        );
        setAppearanceSettings({
          homeHeroImageUrl: payload.blocks?.["home-hero"]?.imageUrl ?? APPEARANCE_DEFAULTS.homeHeroImageUrl,
          transitionImageUrl: payload.blocks?.["page-transition"]?.imageUrl ?? APPEARANCE_DEFAULTS.transitionImageUrl,
        });
        setStatus("Медиа обновлены");
      } catch (error) {
        reportError(error, "Не удалось сохранить изображения");
      } finally {
        setAppearanceSaving(false);
      }
    },
    [reportError],
  );

  const handleSaveAppearance = useCallback(async () => {
    try {
      await persistAppearance(appearanceSettings);
    } catch (error) {
      reportError(error, "Не удалось сохранить изображения");
    }
  }, [appearanceSettings, persistAppearance, reportError]);

  const handleSelectTeamMember = useCallback(
    (id: number) => {
      setTeamSelectedId(id);
      const member = teamMembers.find((item) => item.id === id) ?? null;
      setTeamEditor(member);
    },
    [teamMembers],
  );

  const handleTeamFieldChange = useCallback(
    (field: keyof TeamMemberState, value: string | boolean) => {
      setTeamEditor((prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          [field]: typeof value === "string" ? value : value,
        };
      });
    },
    [],
  );

  const handleTeamSave = useCallback(async () => {
    if (!teamEditor) {
      return;
    }
    if (!teamEditor.name.trim()) {
      setStatus("Введите имя участника");
      return;
    }
    try {
      setTeamSaving(true);
      const payload = {
        name: teamEditor.name.trim(),
        role: teamEditor.role.trim() || null,
        label: teamEditor.label.trim() || null,
        imageUrl: teamEditor.imageUrl.trim() || null,
        mobileImageUrl: teamEditor.mobileImageUrl.trim() || null,
        isFeatured: teamEditor.isFeatured,
      };
      const response = await fetchJson<{ member: TeamMemberState }>(`/api/admin/team/${teamEditor.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      const updatedMember = normalizeTeamMember(response.member);
      setTeamMembers((prev) =>
        prev
          .map((member) => (member.id === updatedMember.id ? updatedMember : member))
          .sort((a, b) => a.order - b.order)
          .map((member, index) => ({ ...member, order: index })),
      );
      setTeamEditor(updatedMember);
      setStatus("Участник обновлён");
    } catch (error) {
      reportError(error, "Не удалось сохранить участника");
    } finally {
      setTeamSaving(false);
    }
  }, [reportError, teamEditor]);

  const handleTeamDelete = useCallback(async () => {
    if (!teamEditor) {
      return;
    }
    if (!window.confirm(`Удалить «${teamEditor.name}» из команды?`)) {
      return;
    }
    try {
      setTeamDeleting(true);
      await fetchJson(`/api/admin/team/${teamEditor.id}`, { method: "DELETE" });
      setTeamMembers((prev) => prev.filter((member) => member.id !== teamEditor.id).map((member, index) => ({ ...member, order: index })));
      const nextMember = teamMembers.find((member) => member.id !== teamEditor.id);
      setTeamSelectedId(nextMember?.id ?? null);
      setTeamEditor(nextMember ?? null);
      setStatus("Участник удалён");
    } catch (error) {
      reportError(error, "Не удалось удалить участника");
    } finally {
      setTeamDeleting(false);
    }
  }, [reportError, teamEditor, teamMembers]);

  const handleCreateTeamMember = useCallback(
    async ({ name, role }: { name: string; role?: string }) => {
      try {
        setTeamLoading(true);
        const response = await fetchJson<{ member: TeamMemberState }>("/api/admin/team", {
          method: "POST",
          body: JSON.stringify({ name, role: role?.trim() || null }),
        });
        const newMember = normalizeTeamMember(response.member);
        setTeamMembers((prev) =>
          [...prev, newMember].sort((a, b) => a.order - b.order).map((member, index) => ({ ...member, order: index })),
        );
        setTeamSelectedId(newMember.id);
        setTeamEditor(newMember);
        setStatus("Участник добавлен");
        setTeamCreateModalOpen(false);
      } catch (error) {
        reportError(error, "Не удалось создать участника");
      } finally {
        setTeamLoading(false);
      }
    },
    [reportError],
  );

  const handleTeamDragStart = useCallback((event: DragStartEvent) => {
    setTeamActiveDragId(Number(event.active.id));
  }, []);

  const handleTeamDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const activeId = Number(active.id);
    const overId = Number(over.id);
    setTeamMembers((prev) => {
      const oldIndex = prev.findIndex((member) => member.id === activeId);
      const newIndex = prev.findIndex((member) => member.id === overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
        return prev;
      }
      return arrayMove(prev, oldIndex, newIndex).map((member, index) => ({ ...member, order: index }));
    });
  }, []);

  const handleTeamDragCancel = useCallback(() => {
    setTeamActiveDragId(null);
    setTeamMembers((prev) => prev.map((member, index) => ({ ...member, order: index })));
  }, []);

  const handleTeamDragEnd = useCallback(
    (event: DragEndEvent) => {
      setTeamActiveDragId(null);
      const { active, over } = event;
      if (!over) {
        setTeamMembers((prev) => prev.map((member, index) => ({ ...member, order: index })));
        return;
      }
      const activeId = Number(active.id);
      const overId = Number(over.id);
      if (activeId === overId) {
        setTeamMembers((prev) => prev.map((member, index) => ({ ...member, order: index })));
        return;
      }
      let nextOrder: number[] = [];
      setTeamMembers((prev) => {
        const oldIndex = prev.findIndex((member) => member.id === activeId);
        const newIndex = prev.findIndex((member) => member.id === overId);
        if (oldIndex === -1 || newIndex === -1) {
          return prev;
        }
        const updated = arrayMove(prev, oldIndex, newIndex).map((member, index) => ({ ...member, order: index }));
        nextOrder = updated.map((member) => member.id);
        return updated;
      });
      if (!nextOrder.length) {
        return;
      }
      void fetchJson("/api/admin/team/reorder", {
        method: "POST",
        body: JSON.stringify({ order: nextOrder }),
      })
        .then(() => setStatus("Порядок команды обновлён"))
        .catch((error) => reportError(error, "Не удалось обновить порядок команды"));
    },
    [reportError],
  );

  const openMediaLibrary = useCallback((mode: MediaLibraryMode, config?: { targetId?: string; initialSelection?: string[] }) => {
    setMediaLibrary({
      open: true,
      mode,
      targetId: config?.targetId,
      initialSelection: config?.initialSelection ?? [],
    });
  }, []);

  const closeMediaLibrary = useCallback(() => {
    setMediaLibrary((prev) => ({ ...prev, open: false }));
  }, []);

  const createLibraryAssetFromUrl = useCallback(
    async ({ url, title }: { url: string; title?: string }) => {
      const payload = {
        url: url.trim(),
        title: title?.trim() ?? undefined,
      };
      if (!payload.url) {
        throw new Error("Укажите ссылку на изображение");
      }

      try {
        const response = await fetchJson<{ asset: LibraryAssetResponse }>("/api/admin/media/library", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        const asset = createMediaAsset(
          response.asset.url,
          response.asset.title ?? payload.title ?? "Изображение",
          "library",
          `library-${response.asset.id}`,
        );
        if (isOptimizedImageUrl(asset.url)) {
          setLibraryAssets((prev) => mergeMediaAssets(prev, [asset]));
        }
        return asset;
      } catch (error) {
        reportError(error, "Не удалось сохранить изображение");
        throw error;
      }
    },
    [reportError],
  );

  const uploadLibraryFile = useCallback(
    async (file: File) => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/admin/media/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!response.ok) {
          let message = "Не удалось загрузить файл";
          const clone = response.clone();
          try {
            const data = await clone.json();
            if (data?.error) {
              message = data.error;
            }
          } catch {
            try {
              const text = await response.text();
              if (text) {
                message = text;
              }
            } catch {
              // ignore
            }
          }
          throw new Error(message);
        }
        const data = (await response.json()) as { url: string };
        const asset = await createLibraryAssetFromUrl({ url: data.url, title: file.name });
        // Убеждаемся, что библиотека обновлена
        setLibraryAssets((prev) => {
          const exists = prev.some((a) => a.url === asset.url);
          if (exists) {
            return prev;
          }
          return mergeMediaAssets(prev, [asset]);
        });
        return asset;
      } catch (error) {
        reportError(error, "Не удалось загрузить файл");
        throw error;
      }
    },
    [createLibraryAssetFromUrl, reportError],
  );

  const handleLibraryApply = useCallback(
    (assets: MediaAsset[]) => {
      if (!assets.length) {
        closeMediaLibrary();
        return;
      }

      setLibraryAssets((prev) => mergeMediaAssets(prev, assets));

      // Content tab: direct content item update
      if (mediaLibrary.mode === "site-hero" || mediaLibrary.mode === "site-transition" || mediaLibrary.mode === "contact-hero") {
        const asset = assets[0];
        if (asset) {
          setContentItems((prev) =>
            prev.map((item) =>
              item.slug === "home-hero" && mediaLibrary.mode === "site-hero"
                ? { ...item, imageUrl: asset.url }
                : item.slug === "page-transition" && mediaLibrary.mode === "site-transition"
                  ? { ...item, imageUrl: asset.url }
                  : item.slug === "contacts" && mediaLibrary.mode === "contact-hero"
                  ? { ...item, imageUrl: asset.url }
                  : item,
            ),
          );
          
          // Также обновляем appearanceSettings для вкладки "Медиа сайта"
          if (mediaLibrary.mode === "site-hero") {
            setAppearanceSettings((prev) => ({ ...prev, homeHeroImageUrl: asset.url }));
          } else if (mediaLibrary.mode === "site-transition") {
            setAppearanceSettings((prev) => ({ ...prev, transitionImageUrl: asset.url }));
          }
        }
      }

      if (mediaLibrary.mode === "hero") {
        const heroAsset = assets[0];
        if (heroAsset) {
          setEditorState((prev) => (prev ? { ...prev, heroImageUrl: heroAsset.url } : prev));
        }
      } else if (mediaLibrary.mode === "gallery-add") {
        setEditorState((prev) => {
          if (!prev) {
            return prev;
          }
          const existingUrls = new Set(prev.gallery.map((item) => item.url));
          const additions = assets
            .filter((asset) => asset.url && !existingUrls.has(asset.url))
            .map((asset) => ({
              id: generateId("gallery"),
              url: asset.url,
              caption: asset.title ?? "",
            }));
          if (!additions.length) {
            return prev;
          }
          return { ...prev, gallery: [...prev.gallery, ...additions] };
        });
      } else if (mediaLibrary.mode === "gallery-replace" && mediaLibrary.targetId) {
        const replacement = assets[0];
        if (replacement) {
          setEditorState((prev) => {
            if (!prev) {
              return prev;
            }
            return {
              ...prev,
              gallery: prev.gallery.map((item) =>
                item.id === mediaLibrary.targetId
                  ? { ...item, url: replacement.url, caption: replacement.title ?? item.caption }
                  : item,
              ),
            };
          });
        }
      } else if (mediaLibrary.mode === "scheme" && mediaLibrary.targetId) {
        const replacement = assets[0];
        if (replacement) {
          setEditorState((prev) => {
            if (!prev) {
              return prev;
            }
            return {
              ...prev,
              schemes: prev.schemes.map((item) =>
                item.id === mediaLibrary.targetId
                  ? {
                      ...item,
                      url: replacement.url,
                      title: item.title && item.title !== "Схема" ? item.title : replacement.title ?? item.title,
                    }
                  : item,
              ),
            };
          });
        }
      } else if (mediaLibrary.mode === "seo") {
        const seoAsset = assets[0];
        if (seoAsset) {
          setEditorState((prev) => (prev ? { ...prev, seoOgImageUrl: seoAsset.url } : prev));
        }
      } else if (mediaLibrary.mode === "seo-page" && mediaLibrary.targetId) {
        const seoAsset = assets[0];
        if (seoAsset) {
          setSeoPages((prev) =>
            prev.map((page) =>
              page.slug === mediaLibrary.targetId ? { ...page, ogImageUrl: seoAsset.url } : page,
            ),
          );
        }
      } else if (mediaLibrary.mode === "contact-hero") {
        const heroAsset = assets[0];
        if (heroAsset) {
          setContactSettings((prev) => ({ ...prev, heroImageUrl: heroAsset.url }));
        }
      } else if (mediaLibrary.mode === "team-image") {
        const teamAsset = assets[0];
        if (teamAsset) {
          setTeamEditor((prev) => (prev ? { ...prev, imageUrl: teamAsset.url } : prev));
        }
      } else if (mediaLibrary.mode === "team-mobile-image") {
        const teamAsset = assets[0];
        if (teamAsset) {
          setTeamEditor((prev) => (prev ? { ...prev, mobileImageUrl: teamAsset.url } : prev));
        }
      }

      closeMediaLibrary();
    },
    [closeMediaLibrary, mediaLibrary],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const data = await fetchJson<{
          projects: ProjectDetailResponse["project"][];
          mediaLibrary: LibraryAssetResponse[];
        }>("/api/admin/projects");
        if (cancelled) return;
        const mappedSummaries = data.projects
          .map((project) => ({
            id: project.id,
            slug: project.slug,
            title: project.title,
            tagline: project.tagline,
            heroImageUrl: project.heroImageUrl,
            categories: (project.categories ?? []) as string[],
            order: project.order,
          }))
          .sort((a, b) => a.order - b.order);

        setProjects(mappedSummaries);
        const libraryAssetsFromDb = (data.mediaLibrary ?? [])
          .map((asset) => createMediaAsset(asset.url, asset.title ?? "", "library", `library-${asset.id}`))
          .filter((asset) => isOptimizedImageUrl(asset.url));
        const projectAssets = collectAssetsFromProjects(data.projects);
        setLibraryAssets(mergeMediaAssets(libraryAssetsFromDb, projectAssets));
        const fallbackSlug = mappedSummaries[0]?.slug ?? null;
        const preferredSlug = selectedSlugRef.current;
        const effectiveSlug =
          preferredSlug && mappedSummaries.some((project) => project.slug === preferredSlug) ? preferredSlug : fallbackSlug;

        setSelectedSlug(effectiveSlug);
        selectedSlugRef.current = effectiveSlug;

        if (effectiveSlug) {
          const detail = data.projects.find((project) => project.slug === effectiveSlug) ?? data.projects[0];
          if (detail) {
            setEditorState(mapProjectToEditor(detail));
            setLibraryAssets((prev) => mergeMediaAssets(prev, collectAssetsFromProjects([detail])));
          } else {
            setEditorState(null);
          }
        } else {
          setEditorState(null);
        }
        setStatus("");
      } catch (error: unknown) {
        reportError(error, "Не удалось загрузить проекты");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [reportError]);

  useEffect(() => {
    let cancelled = false;

    async function loadSeo() {
      try {
        setSeoLoading(true);
        const data = await fetchJson<{ pages: SeoPageResponse[] }>("/api/admin/seo");
        if (cancelled) return;
        const mapped = data.pages.map<SeoPageState>((page) => ({
          slug: page.slug,
          label: page.label,
          path: page.path,
          title: page.seo?.title ?? "",
          description: page.seo?.description ?? "",
          keywords: (page.seo?.keywords ?? []).join(", "),
          ogImageUrl: page.seo?.ogImageUrl ?? "",
          defaults: page.defaults ?? {},
        }));
        setSeoPages(mapped);
        setSelectedSeoSlug((prev) => prev ?? (mapped[0]?.slug ?? null));
      } catch (error: unknown) {
        reportError(error, "Не удалось загрузить SEO");
      } finally {
        if (!cancelled) {
          setSeoLoading(false);
        }
      }
    }

    loadSeo();
    return () => {
      cancelled = true;
    };
  }, [reportError]);

  useEffect(() => {
    if (activeView === "seo" && !selectedSeoSlug && seoPages.length) {
      setSelectedSeoSlug(seoPages[0].slug);
    }
  }, [activeView, selectedSeoSlug, seoPages]);

  // Settings view removed

  const handleSelect = useCallback(
    async (slug: string) => {
      try {
        setSelectedSlug(slug);
        setEditorLoading(true);
        setLoading(true);
        const data = await fetchJson<ProjectDetailResponse>(`/api/admin/projects/${slug}`);
        setEditorState(mapProjectToEditor(data.project));
        setLibraryAssets((prev) => mergeMediaAssets(prev, collectAssetsFromProjects([data.project])));
      } catch (error: unknown) {
        reportError(error, "Не удалось загрузить проект");
      } finally {
        setEditorLoading(false);
        setLoading(false);
      }
    },
    [reportError],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }
      setProjects((prev) => {
        const oldIndex = prev.findIndex((project) => project.slug === active.id);
        const newIndex = prev.findIndex((project) => project.slug === over.id);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
          return prev;
        }
        const reordered = arrayMove(prev, oldIndex, newIndex);
        return reordered.map((project, index) => ({ ...project, order: index }));
      });
    },
    [],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);

      const { active, over } = event;
      if (!over || active.id === over.id) {
        setProjects((prev) => prev.map((project, index) => ({ ...project, order: index })));
        return;
      }

      let nextOrder: string[] = [];
      setProjects((prev) => {
        const oldIndex = prev.findIndex((project) => project.slug === active.id);
        const newIndex = prev.findIndex((project) => project.slug === over.id);
        if (oldIndex === -1 || newIndex === -1) {
          nextOrder = prev.map((project) => project.slug);
          return prev;
        }
        const reordered = arrayMove(prev, oldIndex, newIndex);
        nextOrder = reordered.map((project) => project.slug);
        return reordered.map((project, index) => ({ ...project, order: index }));
      });

      if (!nextOrder.length) {
        return;
      }

      (async () => {
        try {
          await fetchJson("/api/admin/projects/reorder", {
            method: "POST",
            body: JSON.stringify({ order: nextOrder }),
          });
          setStatus("Порядок обновлён");
        } catch (error: unknown) {
          reportError(error, "Не удалось обновить порядок");
        }
      })();
    },
    [reportError],
  );

  const updateEditorField = useCallback(
    <K extends keyof EditorState>(field: K, value: EditorState[K]) => {
      setEditorState((prev) => (prev ? { ...prev, [field]: value } : prev));
    },
    [],
  );

  const handleSeoSelect = useCallback((slug: string) => {
    setSelectedSeoSlug(slug);
  }, []);

  const updateSeoField = useCallback((slug: string, field: SeoEditorField, value: string) => {
    setSeoPages((prev) =>
      prev.map((page) => (page.slug === slug ? { ...page, [field]: value } : page)),
    );
  }, []);

  const handleSeoOgClear = useCallback((slug: string) => {
    setSeoPages((prev) =>
      prev.map((page) => (page.slug === slug ? { ...page, ogImageUrl: "" } : page)),
    );
  }, []);

  const handleSeoSave = useCallback(
    async (slug: string) => {
      const page = seoPages.find((item) => item.slug === slug);
      if (!page) {
        return;
      }
      try {
        setSeoSavingSlug(slug);
        const response = await fetchJson<{ page: SeoPageResponse }>("/api/admin/seo", {
          method: "PUT",
          body: JSON.stringify({
            slug,
            title: page.title.trim() || null,
            description: page.description.trim() || null,
            keywords: splitKeywordsInput(page.keywords),
            ogImageUrl: page.ogImageUrl.trim() || null,
          }),
        });
        const updated = response.page;
        setSeoPages((prev) =>
          prev.map((item) =>
            item.slug === slug
              ? {
                  slug: updated.slug,
                  label: updated.label,
                  path: updated.path,
                  title: updated.seo?.title ?? "",
                  description: updated.seo?.description ?? "",
                  keywords: (updated.seo?.keywords ?? []).join(", "),
                  ogImageUrl: updated.seo?.ogImageUrl ?? "",
                  defaults: updated.defaults ?? {},
                }
              : item,
          ),
        );
        setStatus("SEO обновлено");
      } catch (error: unknown) {
        reportError(error, "Не удалось сохранить SEO");
      } finally {
        setSeoSavingSlug(null);
      }
    },
    [reportError, seoPages],
  );

  const toggleCategory = useCallback((category: string) => {
    setEditorState((prev) => {
      if (!prev) return prev;
      const exists = prev.categories.includes(category);
      return {
        ...prev,
        categories: exists ? prev.categories.filter((item) => item !== category) : [...prev.categories, category],
      };
    });
  }, []);

  const removeGalleryItem = useCallback((id: string) => {
    setEditorState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        gallery: prev.gallery.filter((item) => item.id !== id),
      };
    });
  }, []);

  const handleGalleryDragStart = useCallback((event: DragStartEvent) => {
    setGalleryActiveDragId(String(event.active.id));
  }, []);

  const handleGalleryDragCancel = useCallback(() => {
    setGalleryActiveDragId(null);
  }, []);

  const handleGalleryDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }
      setEditorState((prev) => {
        if (!prev) return prev;
        const oldIndex = prev.gallery.findIndex((item) => item.id === active.id);
        const newIndex = prev.gallery.findIndex((item) => item.id === over.id);
        if (oldIndex === -1 || newIndex === -1) {
          return prev;
        }
        // Убираем проверку oldIndex === newIndex для более частых обновлений
        const reordered = arrayMove(prev.gallery, oldIndex, newIndex);
        return { ...prev, gallery: reordered };
      });
    },
    [],
  );

  const handleGalleryDragEnd = useCallback(
    (event: DragEndEvent) => {
      setGalleryActiveDragId(null);

      const { active, over } = event;
      if (!over || active.id === over.id) {
        setEditorState((prev) => {
          if (!prev) return prev;
          return { ...prev, gallery: [...prev.gallery] };
        });
        return;
      }

      setEditorState((prev) => {
        if (!prev) return prev;
        const oldIndex = prev.gallery.findIndex((item) => item.id === active.id);
        const newIndex = prev.gallery.findIndex((item) => item.id === over.id);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
          return prev;
        }
        const reordered = arrayMove(prev.gallery, oldIndex, newIndex);
        return { ...prev, gallery: reordered };
      });
    },
    [],
  );

  const persistMedia = useCallback(async () => {
    if (!editorState || !selectedSlug) return;

    try {
      setMediaSaving(true);
      await fetchJson(`/api/admin/projects/${selectedSlug}/media`, {
        method: "POST",
        body: JSON.stringify({
          featureImageUrl: editorState.heroImageUrl,
          gallery: editorState.gallery.map((item, index) => ({
            url: item.url,
            caption: item.caption,
            order: index,
          })),
        }),
      });
      setLibraryAssets((prev) => mergeMediaAssets(prev, collectAssetsFromEditor(editorState)));
    } catch (error: unknown) {
      reportError(error, "Не удалось обновить медиа");
      throw error;
    } finally {
      setMediaSaving(false);
    }
  }, [editorState, selectedSlug, reportError]);

  const persistDetails = useCallback(async () => {
    if (!editorState || !selectedSlug) return;

    const errors: string[] = [];
    if (!editorState.title.trim()) {
      errors.push("Введите название проекта");
    }
    if (!editorState.slug.trim()) {
      errors.push("Укажите ссылку на проект");
    }
    if (!editorState.categories.length) {
      errors.push("Выберите хотя бы одну категорию");
    }

    if (errors.length) {
      setStatus(errors.join(". "));
      return;
    }

    try {
      setSaving(true);
      const paragraphs = convertHtmlToParagraphs(editorState.descriptionHtml);
      const descriptionHtml = editorState.descriptionHtml.trim();
      const seoKeywords = editorState.seoKeywords
        .split(",")
        .map((keyword) => keyword.trim())
        .filter((keyword) => keyword.length > 0);
      const response = await fetchJson<ProjectDetailResponse>(`/api/admin/projects/${selectedSlug}`, {
        method: "PATCH",
        body: JSON.stringify({
          slug: editorState.slug,
          title: editorState.title,
          tagline: null,
          location: null,
          year: null,
          area: null,
          scope: null,
          intro: null,
          heroImageUrl: editorState.heroImageUrl,
          categories: editorState.categories,
          descriptionBody: paragraphs,
          descriptionHtml,
          facts: [],
          seoTitle: editorState.seoTitle,
          seoDescription: editorState.seoDescription,
          seoKeywords,
          seoOgImage: editorState.seoOgImageUrl,
        }),
      });

      await persistMedia();

      // После сохранения медиа перезагружаем проект полностью, чтобы получить актуальные данные
      const finalSlug = response.project.slug;
      const updatedResponse = await fetchJson<ProjectDetailResponse>(`/api/admin/projects/${finalSlug}`);

      setStatus("Проект сохранён");
      setProjects((prev) =>
        prev.map((project) =>
          project.slug === selectedSlug
            ? {
                ...project,
                slug: updatedResponse.project.slug,
                title: updatedResponse.project.title,
                tagline: updatedResponse.project.tagline,
                heroImageUrl: updatedResponse.project.heroImageUrl,
                categories: (updatedResponse.project.categories ?? []) as string[],
              }
            : project,
        ),
      );
      setSelectedSlug(updatedResponse.project.slug);
      const updatedEditorState = mapProjectToEditor(updatedResponse.project);
      setEditorState(updatedEditorState);
      // Обновляем библиотеку активов из перезагруженного проекта
      setLibraryAssets((prev) => mergeMediaAssets(prev, collectAssetsFromProjects([updatedResponse.project])));
    } catch (error: unknown) {
      reportError(error, "Не удалось сохранить проект");
    } finally {
      setSaving(false);
    }
  }, [editorState, persistMedia, reportError, selectedSlug]);

  const handleCreateProject = useCallback(
    async ({ slug: requestedSlug, title }: { slug: string; title: string }) => {
      setLoading(true);
      const dynamicSlugs = new Set(existingSlugSet);
      const baseSlug = requestedSlug || "project";
      let candidateSlug = baseSlug;
      let attempts = 0;

      try {
        while (attempts < 6) {
          try {
            const response = await fetchJson<ProjectDetailResponse>("/api/admin/projects", {
              method: "POST",
              body: JSON.stringify({ slug: candidateSlug, title, categories: [] }),
            });

            setProjects((prev) =>
              [
                ...prev,
                {
                  id: response.project.id,
                  slug: response.project.slug,
                  title: response.project.title,
                  tagline: response.project.tagline,
                  heroImageUrl: response.project.heroImageUrl,
                  categories: (response.project.categories ?? []) as string[],
                  order: response.project.order,
                },
              ].sort((a, b) => a.order - b.order),
            );
            setSelectedSlug(response.project.slug);
            setEditorState(mapProjectToEditor(response.project));
            setStatus("Проект создан");
            setLibraryAssets((prev) => mergeMediaAssets(prev, collectAssetsFromProjects([response.project])));
            setCreateModalOpen(false);
            return;
          } catch (error: unknown) {
            if (isSlugConflictError(error)) {
              attempts += 1;
              dynamicSlugs.add(candidateSlug);
              candidateSlug = ensureUniqueSlug(baseSlug, dynamicSlugs);
              continue;
            }
            throw error;
          }
        }

        throw new Error("Не удалось подобрать уникальный адрес проекта");
      } catch (error: unknown) {
        reportError(error, "Не удалось создать проект");
      } finally {
        setLoading(false);
      }
    },
    [existingSlugSet, reportError],
  );

  const handleDeleteProject = useCallback(
    async (slug?: string) => {
      const targetSlug = slug ?? selectedSlug ?? selectedSlugRef.current ?? null;
      if (!targetSlug) {
        return;
      }

      let snapshot: EditorState | null = null;
      let projectTitle = targetSlug;

      if (targetSlug === selectedSlug && editorState) {
        snapshot = editorState;
        projectTitle = editorState.title || editorState.slug;
      } else {
        try {
          const data = await fetchJson<ProjectDetailResponse>(`/api/admin/projects/${targetSlug}`);
          snapshot = mapProjectToEditor(data.project);
          projectTitle = data.project.title || data.project.slug;
        } catch (error: unknown) {
          reportError(error, "Не удалось загрузить проект");
          return;
        }
      }

      if (!snapshot) {
        return;
      }

      const confirmed = window.confirm(
        `Вы уверены, что хотите удалить проект «${projectTitle}»?\n\nЭто действие нельзя отменить.`,
      );
      if (!confirmed) {
        return;
      }

      const deletingCurrent = targetSlug === selectedSlug;
      try {
        if (deletingCurrent) {
          setDeleteLoading(true);
        }
        await fetchJson(`/api/admin/projects/${targetSlug}`, { method: "DELETE" });

        const urlsToRemove = new Set<string>();
        if (snapshot.heroImageUrl) {
          urlsToRemove.add(snapshot.heroImageUrl);
        }
        snapshot.gallery.forEach((item) => {
          if (item.url) {
            urlsToRemove.add(item.url);
          }
        });
        if (snapshot.seoOgImageUrl) {
          urlsToRemove.add(snapshot.seoOgImageUrl);
        }

        setLibraryAssets((prev) =>
          prev.filter((asset) => asset.origin !== "project" || !urlsToRemove.has(asset.url)),
        );

        if (mediaLibrary.open && deletingCurrent) {
          setMediaLibrary((prev) => ({ ...prev, open: false }));
        }

        let nextSlugAfterDelete: string | null = null;
        setProjects((prev) => {
          const currentIndex = prev.findIndex((project) => project.slug === targetSlug);
          const filtered = prev.filter((project) => project.slug !== targetSlug);
          if (filtered.length) {
            const fallbackIndex = currentIndex >= 0 ? Math.min(currentIndex, filtered.length - 1) : 0;
            nextSlugAfterDelete = filtered[fallbackIndex].slug;
            return filtered.map((project, index) => ({ ...project, order: index }));
          }
          nextSlugAfterDelete = null;
          return filtered;
        });

        setStatus("Проект удалён");

        if (deletingCurrent) {
          if (nextSlugAfterDelete) {
            await handleSelect(nextSlugAfterDelete);
          } else {
            setSelectedSlug(null);
            selectedSlugRef.current = null;
            setEditorState(null);
          }
        }
      } catch (error: unknown) {
        reportError(error, "Не удалось удалить проект");
      } finally {
        if (deletingCurrent) {
          setDeleteLoading(false);
        }
      }
    },
    [editorState, handleSelect, mediaLibrary.open, reportError, selectedSlug],
  );

  const handleLogout = useCallback(async () => {
    try {
      setLogoutLoading(true);
      await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    } finally {
      setLogoutLoading(false);
      redirectToLogin();
    }
  }, [redirectToLogin]);

  useEffect(() => {
    setIsClient(true);
    if (!status) {
      return;
    }
    const timer = window.setTimeout(() => setStatus(""), 4000);
    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (activeView !== "content") {
      return;
    }
    setContentLoading(true);
    fetchJson<{ items: ContentItemState[] }>("/api/admin/content")
      .then((data) => {
        const items = (data.items ?? []) as ContentItemState[];
        setContentItems(items);
      })
      .catch((error) => reportError(error, "Не удалось загрузить контент"))
      .finally(() => setContentLoading(false));

    setSocialLoading(true);
    fetchJson<{ links: SocialLinkState[] }>("/api/admin/social")
      .then((data) => {
        const links = Array.isArray(data.links) ? data.links : [];
        setContentSocialLinks(links);
        if (!selectedContentSlug && !selectedSocialId) {
          setSelectedContentSlug(itemsSafeFirstSlug());
        }
      })
      .catch((error) => reportError(error, "Не удалось загрузить соцсети"))
      .finally(() => setSocialLoading(false));

    setPublicationsLoading(true);
    fetchJson<{ publications: string[] }>("/api/admin/publications")
      .then((data) => {
        const pubs = Array.isArray(data.publications) ? data.publications : [];
        setPublications(pubs);
      })
      .catch((error) => reportError(error, "Не удалось загрузить публикации"))
      .finally(() => setPublicationsLoading(false));

    function itemsSafeFirstSlug(): ContentItemState["slug"] | null {
      return (Array.isArray(contentItems) && contentItems[0]?.slug) ? contentItems[0].slug : null;
    }
  }, [activeView, reportError]);

  return (
    <div className={styles.adminShell}>
      <header className={styles.adminHeader}>
        <div className={styles.branding}>
          <span className={styles.brandTitle}>RINART Admin</span>
          <span className={styles.brandSubtitle}>
            {activeView === "projects" ? "Управление портфолио" : activeView === "seo" ? "SEO сайта" : activeView === "content" ? "Контент сайта" : "Настройки"}
          </span>
          <nav className={styles.viewTabs} aria-label="Разделы админки">
            <button
              type="button"
              className={styles.viewTabButton}
              data-active={activeView === "projects"}
              onClick={() => setActiveView("projects")}
              disabled={activeView === "projects"}
            >
              Проекты
            </button>
            <button
              type="button"
              className={styles.viewTabButton}
              data-active={activeView === "seo"}
              onClick={() => setActiveView("seo")}
              disabled={activeView === "seo"}
            >
              SEO
            </button>
            <button
              type="button"
              className={styles.viewTabButton}
              data-active={activeView === "content"}
              onClick={() => setActiveView("content")}
              disabled={activeView === "content"}
            >
              Контент
            </button>
            <button
              type="button"
              className={styles.viewTabButton}
              data-active={activeView === "settings"}
              onClick={() => setActiveView("settings")}
              disabled={activeView === "settings"}
            >
              Настройки
            </button>
          </nav>
        </div>
        <div className={styles.headerActions}>
          {status ? <span className={styles.statusBadge}>{status}</span> : null}
          <button className={styles.ghostButton} type="button" onClick={handleLogout} disabled={logoutLoading}>
            {logoutLoading ? "Выходим..." : "Выйти"}
          </button>
        </div>
      </header>

      <div className={styles.adminContent} data-view={activeView}>
        {activeView === "projects" ? (
          <>
            <aside className={styles.projectColumn}>
              <div className={styles.projectColumnHeader}>
                <div>
                  <h2 className={styles.columnTitle}>Проекты</h2>
                  <p className={styles.columnSubtitle}>Перетаскивайте карточки, чтобы изменить порядок вывода.</p>
                </div>
                <button
                  className={styles.primaryButton}
                  type="button"
                  disabled={loading}
                  onClick={() => setCreateModalOpen(true)}
                >
                  Создать
                </button>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() =>
                    openMediaLibrary("gallery-add", {
                      initialSelection: [],
                    })
                  }
                >
                  Общая библиотека
                </button>
              </div>

              <div className={styles.projectColumnBody}>
                <div className={styles.projectList} suppressHydrationWarning>
                  {showProjectSkeleton ? (
                    <ProjectListSkeleton />
                  ) : isClient ? (
                    <DndContext
                      accessibility={PROJECTS_DND_ACCESSIBILITY}
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      modifiers={[restrictToVerticalAxis]}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDragEnd={handleDragEnd}
                      onDragCancel={handleDragCancel}
                    >
                      <SortableContext items={projects.map((project) => project.slug)} strategy={verticalListSortingStrategy}>
                        {projects.map((project, index) => (
                          <SortableProjectItem
                            key={project.slug}
                            project={project}
                            index={index}
                            isActive={project.slug === selectedSlug}
                            onSelect={handleSelect}
                            onDelete={handleDeleteProject}
                          />
                        ))}
                      </SortableContext>
                      <DragOverlay>
                        {activeProject ? (
                          <ProjectListCard
                            project={activeProject}
                            index={Math.max(0, projects.findIndex((item) => item.slug === activeProject.slug))}
                            isActive={false}
                            onSelect={() => {}}
                            onDelete={() => {}}
                            animated={false}
                          />
                        ) : null}
                      </DragOverlay>
                    </DndContext>
                  ) : null}

                </div>
              </div>
            </aside>

            <main className={styles.editorColumn}>
              {showEditorSkeleton ? (
                <EditorSkeleton />
              ) : editorState ? (
                <ProjectEditor
                  state={editorState}
                  onFieldChange={updateEditorField}
                  onToggleCategory={toggleCategory}
                  saving={saving}
                  deleting={deleteLoading}
                  onDelete={handleDeleteProject}
                  onSave={persistDetails}
                  onOpenOgImagePicker={() =>
                    openMediaLibrary("seo", {
                      initialSelection: editorState.seoOgImageUrl ? [editorState.seoOgImageUrl] : [],
                    })
                  }
                />
              ) : (
                <div className={styles.emptyState}>Выберите проект, чтобы открыть подробное редактирование.</div>
              )}
            </main>

            <aside className={styles.mediaColumn}>
              {showEditorSkeleton ? (
                <MediaPanelSkeleton />
              ) : editorState ? (
                <MediaPanel
                  state={editorState}
                  updateField={updateEditorField}
                  removeGalleryItem={removeGalleryItem}
                  onOpenLibrary={openMediaLibrary}
                  onGalleryDragStart={handleGalleryDragStart}
                  onGalleryDragOver={handleGalleryDragOver}
                  onGalleryDragEnd={handleGalleryDragEnd}
                  onGalleryDragCancel={handleGalleryDragCancel}
                  galleryActiveDragId={galleryActiveDragId}
                  sensors={sensors}
                  onSave={persistDetails}
                  onDelete={handleDeleteProject}
                  saving={saving}
                  deleting={deleteLoading}
                />
              ) : null}
            </aside>
          </>
        ) : activeView === "seo" ? (
          <>
            <aside className={`${styles.projectColumn} ${styles.seoListColumn}`}>
              <div className={styles.projectColumnHeader}>
                <div>
                  <h2 className={styles.columnTitle}>Страницы</h2>
                  <p className={styles.columnSubtitle}>Выберите страницу, чтобы настроить метаданные.</p>
                </div>
              </div>
              <div className={styles.projectColumnBody}>
                {showSeoSkeleton ? (
                  <SeoListSkeleton />
                ) : seoPages.length ? (
                  <div className={styles.seoPageList}>
                    {seoPages.map((page) => (
                      <SeoPageListItem
                        key={page.slug}
                        page={page}
                        isActive={page.slug === selectedSeoSlug}
                        onSelect={handleSeoSelect}
                      />
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyState}>Нет доступных страниц для настройки.</div>
                )}
              </div>
            </aside>
            <main className={`${styles.editorColumn} ${styles.seoEditorColumn}`}>
              {selectedSeoPage ? (
                <SeoEditorPanel
                  page={selectedSeoPage}
                  onFieldChange={(field, value) => updateSeoField(selectedSeoPage.slug, field, value)}
                  onSave={() => handleSeoSave(selectedSeoPage.slug)}
                  onClearOgImage={() => handleSeoOgClear(selectedSeoPage.slug)}
                  onOpenOgPicker={() =>
                    openMediaLibrary("seo-page", {
                      targetId: selectedSeoPage.slug,
                      initialSelection: selectedSeoPage.ogImageUrl ? [selectedSeoPage.ogImageUrl] : [],
                    })
                  }
                  saving={seoSaving}
                />
              ) : showSeoSkeleton ? (
                <SeoEditorSkeleton />
              ) : (
                <div className={styles.emptyState}>Выберите страницу, чтобы изменить SEO.</div>
              )}
            </main>
          </>
        ) : activeView === "content" ? (
          <>
            <aside className={`${styles.projectColumn} ${styles.seoListColumn}`}>
              <div className={styles.projectColumnHeader}>
                <div>
                  <h2 className={styles.columnTitle}>Контент</h2>
                  <p className={styles.columnSubtitle}>Публикации и награды.</p>
                </div>
              </div>
              <div className={styles.projectColumnBody}>
                {publicationsLoading ? (
                  <SeoListSkeleton />
                ) : (
                  <div className={styles.seoPageList}>
                    <SeoPageListItem
                      page={{ slug: "publications-block", label: "Публикации и награды", path: "", title: "", description: "", keywords: "", ogImageUrl: "", defaults: {} as SeoPageDefaults } as unknown as SeoPageState}
                      isActive={true}
                      onSelect={() => {}}
                    />
                  </div>
                )}
              </div>
            </aside>
            <main className={`${styles.editorColumn} ${styles.seoEditorColumn}`}>
              {publicationsLoading ? (
                <SeoEditorSkeleton />
              ) : (
                <div className={styles.settingsPanel}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Публикации и награды</label>
                    <div className={styles.formGrid}>
                      {publications.map((pub, index) => (
                        <div key={`pub-${index}`} className={styles.inputGroup} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "8px" }}>
                          <input
                            className={styles.textInput}
                            value={pub}
                            onChange={(e) => {
                              const value = e.target.value;
                              setPublications((prev) => {
                                const next = [...prev];
                                next[index] = value;
                                return next;
                              });
                            }}
                            placeholder="Введите публикацию или награду"
                            style={{ flex: 1 }}
                          />
                          <button
                            type="button"
                            className={styles.projectDelete}
                            aria-label="Удалить публикацию"
                            data-visible="static"
                            style={{ marginLeft: 0 }}
                            onClick={() => {
                              setPublications((prev) => prev.filter((_, i) => i !== index));
                            }}
                          >
                            <IconTrash aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      onClick={() => {
                        setPublications((prev) => [...prev, ""]);
                      }}
                    >
                      Добавить публикацию
                    </button>
                  </div>
                  <div className={styles.formActions}>
                    <button
                      className={styles.primaryButton}
                      type="button"
                      onClick={async () => {
                        try {
                          setPublicationsSaving(true);
                          const filtered = publications.filter((p) => p.trim().length > 0);
                          const response = await fetchJson<{ publications: string[] }>("/api/admin/publications", {
                            method: "PUT",
                            body: JSON.stringify({ publications: filtered }),
                          });
                          setPublications(response.publications ?? []);
                          setStatus("Публикации обновлены");
                        } catch (error) {
                          reportError(error, "Не удалось сохранить публикации");
                        } finally {
                          setPublicationsSaving(false);
                        }
                      }}
                      disabled={publicationsSaving || publicationsLoading}
                    >
                      {publicationsSaving ? "Сохраняем..." : "Сохранить публикации"}
                    </button>
                  </div>
                </div>
              )}
            </main>
          </>
        ) : activeView === "settings" ? (
          <SettingsView
            contactSettings={contactSettings}
            socialLinks={socialLinks}
            onContactChange={handleContactFieldChange}
            onSocialChange={handleSocialFieldChange}
            onSaveContacts={handleSaveSettings}
            onSaveSocials={handleSaveSocials}
            settingsLoading={settingsLoading}
            settingsSaving={settingsSaving}
            appearanceSettings={appearanceSettings}
            appearanceLoading={appearanceLoading}
            appearanceSaving={appearanceSaving}
            onAppearanceChange={handleAppearanceFieldChange}
            onSaveAppearance={handleSaveAppearance}
            teamMembers={teamMembers}
            teamLoading={teamLoading}
            teamSelectedId={teamSelectedId}
            teamEditor={teamEditor}
            onTeamSelect={handleSelectTeamMember}
            onTeamFieldChange={handleTeamFieldChange}
            onTeamSave={handleTeamSave}
            onTeamDelete={handleTeamDelete}
            onTeamCreate={() => setTeamCreateModalOpen(true)}
            onTeamDragStart={handleTeamDragStart}
            onTeamDragOver={handleTeamDragOver}
            onTeamDragEnd={handleTeamDragEnd}
            onTeamDragCancel={handleTeamDragCancel}
            teamSaving={teamSaving}
            teamDeleting={teamDeleting}
            teamLoaded={teamLoaded}
            sensors={sensors}
            teamCreateModalOpen={teamCreateModalOpen}
            onCloseCreateModal={() => setTeamCreateModalOpen(false)}
            onCreateTeamMember={handleCreateTeamMember}
            activeTeamMember={activeTeamMember}
            onOpenMediaLibrary={(mode, options) => openMediaLibrary(mode, options)}
          />
        ) : null}
      </div>

      {mediaLibrary.open ? (
          <MediaLibraryModal
          key={`media-modal-${mediaLibrary.mode}`}
          assets={libraryAssets}
          allowMultiple={mediaLibrary.mode === "gallery-add"}
          initialSelection={mediaLibrary.initialSelection}
          onClose={closeMediaLibrary}
          onApply={handleLibraryApply}
          onCreateAsset={createLibraryAssetFromUrl}
          onUploadFile={uploadLibraryFile}
          onDeleteAsset={deleteLibraryAsset}
        />
      ) : null}
      {createModalOpen ? (
        <CreateProjectModal
          onClose={() => setCreateModalOpen(false)}
          onCreate={handleCreateProject}
          existingSlugs={existingSlugSet}
        />
      ) : null}
    </div>
  );
}

function SeoListSkeleton() {
  return <ProjectListSkeleton />;
}

function SeoEditorSkeleton() {
  return <EditorSkeleton />;
}

function SeoPageListItem({
  page,
  isActive,
  onSelect,
}: {
  page: SeoPageState;
  isActive: boolean;
  onSelect: (slug: string) => void;
}) {
  const hasOverrides =
    page.title.trim().length > 0 ||
    page.description.trim().length > 0 ||
    page.keywords.trim().length > 0 ||
    page.ogImageUrl.trim().length > 0;
  return (
    <button
      type="button"
      className={styles.seoPageButton}
      data-active={isActive}
      data-overridden={hasOverrides}
      onClick={() => onSelect(page.slug)}
    >
      <span className={styles.seoPageLabel}>{page.label}</span>
      <span className={styles.seoPagePath}>{page.path}</span>
      {hasOverrides ? <span className={styles.seoPageMeta}>Используются собственные данные</span> : null}
    </button>
  );
}

function SeoEditorPanel({
  page,
  onFieldChange,
  onSave,
  onOpenOgPicker,
  onClearOgImage,
  saving,
}: {
  page: SeoPageState;
  onFieldChange: (field: SeoEditorField, value: string) => void;
  onSave: () => void;
  onOpenOgPicker: () => void;
  onClearOgImage: () => void;
  saving: boolean;
}) {
  const defaultKeywords = page.defaults.keywords?.length ? page.defaults.keywords.join(", ") : "";
  const hasOgImage = Boolean(page.ogImageUrl.trim());

  const handleSubmit = (event: ReactFormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave();
  };

  return (
    <form className={styles.seoEditorForm} onSubmit={handleSubmit}>
      <header className={styles.seoEditorHeader}>
        <div>
          <h2 className={styles.columnTitle}>{page.label}</h2>
          <p className={styles.columnSubtitle}>Настройте заголовки, описания и изображение для соцсетей.</p>
        </div>
        <code className={styles.seoPathBadge}>{page.path}</code>
      </header>

      <label className={styles.inputGroup}>
        <LabelWithHint label="Title" hint="Заголовок, который появляется в результатах поиска и во вкладке браузера." />
        <input
          className={styles.textInput}
          value={page.title}
          onChange={(event) => onFieldChange("title", event.target.value)}
          placeholder={page.defaults.title ?? ""}
        />
      </label>

      <label className={styles.inputGroup}>
        <LabelWithHint
          label="Description"
          hint="Краткое описание страницы для поисковых систем и социальных сетей."
        />
        <textarea
          className={`${styles.textInput} ${styles.seoTextarea}`}
          value={page.description}
          onChange={(event) => onFieldChange("description", event.target.value)}
          placeholder={page.defaults.description ?? ""}
          rows={5}
        />
      </label>

      <label className={styles.inputGroup}>
        <LabelWithHint label="Ключевые слова" hint="Перечислите слова через запятую. Они помогут поисковикам понять контент." />
        <input
          className={styles.textInput}
          value={page.keywords}
          onChange={(event) => onFieldChange("keywords", event.target.value)}
          placeholder={defaultKeywords}
        />
        <span className={styles.seoHelperText}>Например: архитектура, rinart, мастерская</span>
      </label>

      <div className={styles.seoOgSection}>
        <LabelWithHint
          label="OG-изображение"
          hint="Будет показано при шаринге страницы в социальных сетях и мессенджерах."
        />
        <div className={styles.seoOgPreview}>
          {hasOgImage ? (
            <SafeImage
              src={page.ogImageUrl}
              alt="OG-превью"
              className={styles.seoOgPreviewImage}
              width={640}
              height={360}
            />
          ) : (
            <div className={styles.seoOgEmpty}>Изображение не выбрано</div>
          )}
        </div>
        <div className={styles.seoOgActions}>
          <button type="button" className={styles.secondaryButton} onClick={onOpenOgPicker}>
            Выбрать из библиотеки
          </button>
          {hasOgImage ? (
            <button type="button" className={styles.ghostButton} onClick={onClearOgImage}>
              Очистить
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.seoActions}>
        <button className={styles.primaryButton} type="submit" disabled={saving}>
          {saving ? "Сохраняем..." : "Сохранить"}
        </button>
      </div>
    </form>
  );
}

function FieldHint({ text }: { text: string }) {
  const tooltipId = useId();
  return (
    <span className={styles.fieldHint} role="button" tabIndex={0} aria-describedby={tooltipId}>
      <span className={styles.fieldHintIcon}>?</span>
      <span className={styles.fieldHintTooltip} id={tooltipId} role="tooltip">
        {text}
      </span>
    </span>
  );
}

function LabelWithHint({ label, hint }: { label: string; hint: string }) {
  return (
    <span className={styles.inputLabelRow}>
      <span className={styles.inputLabel}>{label}</span>
      <FieldHint text={hint} />
    </span>
  );
}

function CreateProjectModal({
  onClose,
  onCreate,
  existingSlugs,
}: {
  onClose: () => void;
  onCreate: (payload: { slug: string; title: string }) => Promise<void> | void;
  existingSlugs: Set<string>;
}) {
  const [title, setTitle] = useState("");
  const slug = useMemo(() => {
    const base = slugifyTitle(title);
    return base ? ensureUniqueSlug(base, existingSlugs) : "";
  }, [existingSlugs, title]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [onClose]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !slug) {
      return;
    }
    await onCreate({ slug, title: title.trim() });
    setTitle("");
  };

  return (
    <div className={styles.createModalOverlay} role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className={styles.createModal}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <header className={styles.createModalHeader}>
          <div>
            <h3 className={styles.createModalTitle}>Новый проект</h3>
            <p className={styles.createModalSubtitle}>Введите название — адрес страницы сформируется автоматически.</p>
          </div>
          <button className={styles.iconGhostButton} type="button" onClick={onClose} aria-label="Закрыть форму">
            <IconX aria-hidden="true" />
          </button>
        </header>
        <form className={styles.createModalForm} onSubmit={handleSubmit}>
          <label className={styles.inputGroup}>
            <LabelWithHint label="Название" hint="Отображается в портфолио и на странице проекта." />
            <input
              className={styles.textInput}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например: Дом у озера"
              autoFocus
              required
            />
          </label>
          <div className={styles.slugPreview}>
            <span className={styles.slugLabel}>Ссылка</span>
            <code className={styles.slugValue}>{slug || "—"}</code>
          </div>
          <div className={styles.modalActions}>
            <button className={styles.ghostButton} type="button" onClick={onClose}>
              Отмена
            </button>
            <button className={styles.primaryButton} type="submit" disabled={!title.trim() || !slug}>
              Создать
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProjectEditor({
  state,
  onFieldChange,
  onToggleCategory,
  onSave,
  saving,
  onDelete,
  deleting,
  onOpenOgImagePicker,
}: {
  state: EditorState;
  onFieldChange: EditorFieldChangeHandler;
  onToggleCategory: (category: string) => void;
  onSave: () => Promise<void>;
  saving: boolean;
  onDelete: () => void | Promise<void>;
  deleting: boolean;
  onOpenOgImagePicker: () => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const draggedImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== state.descriptionHtml) {
      editorRef.current.innerHTML = state.descriptionHtml;
    }
  }, [state.descriptionHtml]);

  // Функция для установки обработчиков drag and drop на изображение
  const setupImageDragHandlers = useCallback((img: HTMLImageElement) => {
    const handleImageDragStart = (event: DragEvent) => {
      const targetImg = event.target as HTMLImageElement;
      if (targetImg.tagName !== "IMG") return;
      
      draggedImageRef.current = targetImg;
      targetImg.style.opacity = "0.5";
      
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/html", targetImg.outerHTML);
      }
    };

    const handleImageDragEnd = (event: DragEvent) => {
      const targetImg = event.target as HTMLImageElement;
      if (targetImg.tagName !== "IMG") return;
      
      targetImg.style.opacity = "1";
      draggedImageRef.current = null;
    };

    img.draggable = true;
    img.style.cursor = "move";
    img.addEventListener("dragstart", handleImageDragStart);
    img.addEventListener("dragend", handleImageDragEnd);
  }, []);

  // Делаем все изображения в редакторе перетаскиваемыми
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const images = editor.querySelectorAll<HTMLImageElement>("img");
    images.forEach((img) => {
      setupImageDragHandlers(img);
    });

    return () => {
      // Очистка обработчиков не требуется, так как они будут удалены при размонтировании элементов
    };
  }, [state.descriptionHtml, setupImageDragHandlers]);

  const syncEditorHtml = useCallback(() => {
    if (editorRef.current) {
      onFieldChange("descriptionHtml", editorRef.current.innerHTML);
    }
  }, [onFieldChange]);

  const focusEditor = useCallback(() => {
    editorRef.current?.focus();
  }, []);

  const handleRichTextInput = useCallback(() => {
    syncEditorHtml();
  }, [syncEditorHtml]);

  const executeCommand = (command: string, value?: string) => {
    focusEditor();
    document.execCommand(command, false, value);
    syncEditorHtml();
  };

  const handleFormatBlock = (block: string) => {
    focusEditor();
    document.execCommand("formatBlock", false, block);
    syncEditorHtml();
  };

  const handleInsertImage = () => {
    handleImageButtonClick();
  };

  const handleClearFormatting = () => {
    focusEditor();
    document.execCommand("removeFormat");
    document.execCommand("formatBlock", false, "P");
    syncEditorHtml();
  };

  const insertImageRef = useRef<(url: string) => void>(() => {});

  useEffect(() => {
    insertImageRef.current = (url: string) => {
      const trimmed = url.trim();
      if (!trimmed) {
        return;
      }
      focusEditor();
      document.execCommand("insertImage", false, trimmed);
      syncEditorHtml();
    };
  }, [syncEditorHtml]);

  const insertImage = useCallback((url: string) => {
    insertImageRef.current(url);
  }, []);

  const handleImageButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        insertImage(reader.result);
      }
      event.target.value = "";
    };
    reader.readAsDataURL(file);
  };

  const handleEditorDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    
    // Если перетаскивается существующее изображение из редактора
    if (draggedImageRef.current) {
      event.dataTransfer.dropEffect = "move";
    } else {
      // Перетаскивание файла извне
      event.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const handleEditorDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const { dataTransfer } = event;
      
      // Если перетаскивается существующее изображение из редактора
      if (draggedImageRef.current) {
        const draggedImg = draggedImageRef.current;
        const editor = editorRef.current;
        if (!editor) return;
        
        // Определяем позицию вставки используя координаты мыши
        let range: Range | null = null;
        if (document.caretRangeFromPoint) {
          range = document.caretRangeFromPoint(event.clientX, event.clientY);
        } else if ((document as any).caretPositionFromPoint) {
          // Fallback для Firefox
          const caretPos = (document as any).caretPositionFromPoint(event.clientX, event.clientY);
          if (caretPos) {
            range = document.createRange();
            range.setStart(caretPos.offsetNode, caretPos.offset);
            range.collapse(true);
          }
        }
        
        if (!range) {
          // Если не удалось определить позицию, просто восстанавливаем изображение
          draggedImg.style.opacity = "1";
          draggedImageRef.current = null;
          return;
        }
        
        // Находим узел, куда будем вставлять
        let insertNode: Node = range.startContainer;
        
        // Если это текстовый узел, работаем с его родителем
        if (insertNode.nodeType === Node.TEXT_NODE) {
          insertNode = insertNode.parentNode || editor;
        }
        
        // Проверяем, что не перетаскиваем на само изображение или его родителя
        if (draggedImg === insertNode || draggedImg.contains(insertNode) || (insertNode as Element).contains?.(draggedImg)) {
          draggedImg.style.opacity = "1";
          draggedImageRef.current = null;
          return;
        }
        
        // Если курсор указывает на само изображение, ничего не делаем
        if (range.startContainer === draggedImg || range.startContainer.parentNode === draggedImg) {
          draggedImg.style.opacity = "1";
          draggedImageRef.current = null;
          return;
        }
        
        // Создаем клон изображения
        const clonedImg = draggedImg.cloneNode(true) as HTMLImageElement;
        clonedImg.style.opacity = "1";
        
        // Устанавливаем обработчики drag and drop на клонированное изображение
        setupImageDragHandlers(clonedImg);
        
        // Определяем место вставки на основе типа элемента
        const targetElement = insertNode as Element;
        
        if (targetElement.nodeType === Node.ELEMENT_NODE) {
          const tagName = targetElement.tagName.toUpperCase();
          
          // Для блочных элементов (P, DIV, H2, H3) проверяем, можно ли вставить внутрь
          if (tagName === "P" || tagName === "DIV" || tagName === "H2" || tagName === "H3" || tagName === "LI") {
            // Проверяем, пустой ли элемент
            const isEmpty = !targetElement.textContent?.trim() && !targetElement.querySelector("img");
            
            if (isEmpty) {
              // Элемент пустой - вставляем внутрь
              targetElement.appendChild(clonedImg);
            } else {
              // Элемент не пустой - вставляем после него
              const parent = targetElement.parentElement;
              if (parent) {
                if (targetElement.nextSibling) {
                  parent.insertBefore(clonedImg, targetElement.nextSibling);
                } else {
                  parent.appendChild(clonedImg);
                }
              }
            }
          } else if (tagName === "IMG") {
            // Если курсор на другом изображении, вставляем после него
            const parent = targetElement.parentElement;
            if (parent) {
              if (targetElement.nextSibling) {
                parent.insertBefore(clonedImg, targetElement.nextSibling);
              } else {
                parent.appendChild(clonedImg);
              }
            }
          } else {
            // Для других элементов вставляем после
            const parent = targetElement.parentElement;
            if (parent) {
              if (targetElement.nextSibling) {
                parent.insertBefore(clonedImg, targetElement.nextSibling);
              } else {
                parent.appendChild(clonedImg);
              }
            }
          }
        } else {
          // Для текстовых узлов вставляем после родителя
          const parent = insertNode.parentElement;
          if (parent) {
            if (insertNode.nextSibling) {
              parent.insertBefore(clonedImg, insertNode.nextSibling);
            } else {
              parent.appendChild(clonedImg);
            }
          }
        }
        
        // Удаляем оригинальное изображение
        draggedImg.remove();
        draggedImg.style.opacity = "1";
        draggedImageRef.current = null;
        
        // Синхронизируем HTML
        syncEditorHtml();
        return;
      }
      
      // Сначала проверяем файлы - это приоритетно при перетаскивании
      const files = dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") {
              insertImage(reader.result);
            }
          };
          reader.readAsDataURL(file);
          return;
        }
      }

      // Затем проверяем URL из различных форматов
      const uriList = dataTransfer.getData("text/uri-list");
      if (uriList && looksLikeUrl(uriList.trim())) {
        insertImage(uriList.trim());
        return;
      }

      // Проверяем plain text только если это похоже на URL
      const plainText = dataTransfer.getData("text/plain");
      if (plainText) {
        const trimmed = plainText.trim();
        // Игнорируем локальные пути файлов (file://)
        if (trimmed.startsWith("file://")) {
          return;
        }
        if (looksLikeUrl(trimmed)) {
          insertImage(trimmed);
          return;
        }
        // Вставляем текст только если это не путь к файлу
        focusEditor();
        document.execCommand("insertText", false, plainText);
        syncEditorHtml();
      }
    },
    [insertImage, syncEditorHtml, focusEditor, setupImageDragHandlers],
  );

  const handleEditorPaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      event.preventDefault();
      const text = event.clipboardData?.getData("text/plain") ?? "";
      if (!text) {
        return;
      }
      focusEditor();
      document.execCommand("insertText", false, text);
      syncEditorHtml();
    },
    [syncEditorHtml],
  );

  const handleToolbarMouseDown = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  return (
    <div className={styles.editorStack}>
      <section className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionTitle}>Основные данные</h3>
            <p className={styles.sectionSubtitle}>Ссылка формирует адрес страницы проекта</p>
          </div>
        </div>
        <div className={`${styles.formGrid} ${styles.gridTwo}`}>
          <label className={styles.inputGroup}>
            <LabelWithHint
              label="Ссылка"
              hint="Латинский адрес проекта в URL, используйте дефисы вместо пробелов."
            />
            <input
              className={styles.textInput}
              value={state.slug}
              onChange={(event) => onFieldChange("slug", event.target.value)}
            />
          </label>
          <label className={styles.inputGroup}>
            <LabelWithHint label="Название" hint="Официальное название проекта, отображается на сайте и в списках." />
            <input
              className={styles.textInput}
              value={state.title}
              onChange={(event) => onFieldChange("title", event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleRow}>
            <h3 className={styles.sectionTitle}>Категории</h3>
            <FieldHint text="Отметьте направления, чтобы проект правильно попадал в фильтры портфолио." />
          </div>
          <p className={styles.sectionSubtitle}>Используются для фильтрации в портфолио</p>
        </div>
        <div className={styles.categoryChips}>
          {CATEGORY_OPTIONS.map((category) => (
            <button
              key={category.id}
              type="button"
              className={styles.categoryChip}
              data-active={state.categories.includes(category.id)}
              onClick={() => onToggleCategory(category.id)}
            >
              {category.label}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleRow}>
            <h3 className={styles.sectionTitle}>Описание</h3>
            <FieldHint text="Редактор поддерживает форматирование, списки и вставку изображений через буфер обмена." />
          </div>
          <p className={styles.sectionSubtitle}>Добавьте подробный текст и выделите ключевые мысли</p>
        </div>
        <div className={styles.richEditor}>
          <div className={styles.editorToolbar}>
            <div className={styles.toolbarGroup}>
              <button
                className={styles.toolbarButton}
                type="button"
                onClick={() => executeCommand("bold")}
                title="Полужирный"
                aria-label="Полужирный"
                onMouseDown={handleToolbarMouseDown}
              >
                B
              </button>
              <button
                className={styles.toolbarButton}
                type="button"
                onClick={() => executeCommand("italic")}
                title="Курсив"
                aria-label="Курсив"
                onMouseDown={handleToolbarMouseDown}
              >
                I
              </button>
            </div>
            <div className={styles.toolbarGroup}>
              <button
                className={styles.toolbarButton}
                type="button"
                onClick={() => handleFormatBlock("H2")}
                title="Заголовок H2"
                aria-label="Заголовок H2"
                onMouseDown={handleToolbarMouseDown}
              >
                H2
              </button>
              <button
                className={styles.toolbarButton}
                type="button"
                onClick={() => handleFormatBlock("H3")}
                title="Заголовок H3"
                aria-label="Заголовок H3"
                onMouseDown={handleToolbarMouseDown}
              >
                H3
              </button>
              <button
                className={styles.toolbarButton}
                type="button"
                onClick={() => handleFormatBlock("P")}
                title="Обычный абзац"
                aria-label="Обычный абзац"
                onMouseDown={handleToolbarMouseDown}
              >
                P
              </button>
            </div>
            <div className={styles.toolbarGroup}>
              <button
                className={styles.toolbarButton}
                type="button"
                onClick={() => executeCommand("insertUnorderedList")}
                title="Маркированный список"
                aria-label="Маркированный список"
                onMouseDown={handleToolbarMouseDown}
              >
                •
              </button>
              <button
                className={styles.toolbarButton}
                type="button"
                onClick={() => executeCommand("insertOrderedList")}
                title="Нумерованный список"
                aria-label="Нумерованный список"
                onMouseDown={handleToolbarMouseDown}
              >
                1.
              </button>
            </div>
            <div className={styles.toolbarGroup}>
              <button
                className={styles.toolbarButton}
                type="button"
                onClick={handleInsertImage}
                title="Загрузить изображение"
                aria-label="Загрузить изображение"
                onMouseDown={handleToolbarMouseDown}
              >
                IMG
              </button>
              <button
                className={styles.toolbarButton}
                type="button"
                onClick={handleClearFormatting}
                title="Очистить форматирование"
                aria-label="Очистить форматирование"
                onMouseDown={handleToolbarMouseDown}
              >
                <IconEraser aria-hidden="true" />
                <span className={styles.visuallyHidden}>Очистить форматирование</span>
              </button>
            </div>
          </div>
          <div
            ref={editorRef}
            className={styles.editorContent}
            contentEditable
            suppressContentEditableWarning
            dir="ltr"
            onBlur={syncEditorHtml}
            onInput={handleRichTextInput}
            onDragOver={handleEditorDragOver}
            onDrop={handleEditorDrop}
            onPaste={handleEditorPaste}
            spellCheck
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageFileChange}
            className={styles.hiddenFileInput}
            tabIndex={-1}
          />
        </div>
      </section>

      <section className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleRow}>
            <h3 className={styles.sectionTitle}>SEO и мета</h3>
            <FieldHint text="Эти поля помогают поисковикам и соцсетям корректно отобразить проект." />
          </div>
          <p className={styles.sectionSubtitle}>Опишите, как проект должен выглядеть в поиске и при шаринге</p>
        </div>
        <div className={`${styles.formGrid} ${styles.gridTwo}`}>
          <label className={styles.inputGroup}>
            <LabelWithHint
              label="SEO Title"
              hint="Заголовок для поисковой выдачи, держите его до 60 символов."
            />
            <input
              className={styles.textInput}
              value={state.seoTitle}
              onChange={(event) => onFieldChange("seoTitle", event.target.value)}
              placeholder="Например: Современный дом в Казани – Rinart"
            />
          </label>
          <label className={styles.inputGroup}>
            <LabelWithHint
              label="SEO Description"
              hint="Короткое описание до 160 символов для сниппета в поиске."
            />
            <textarea
              className={`${styles.textInput} ${styles.textArea}`}
              value={state.seoDescription}
              onChange={(event) => onFieldChange("seoDescription", event.target.value)}
              rows={3}
              placeholder="Опишите суть проекта парой предложений."
            />
          </label>
        </div>
        <div className={`${styles.formGrid} ${styles.gridTwo}`}>
          <label className={styles.inputGroup}>
            <LabelWithHint
              label="SEO Keywords"
              hint="Список ключевых слов через запятую: город, тип проекта, особенности."
            />
            <input
              className={styles.textInput}
              value={state.seoKeywords}
              onChange={(event) => onFieldChange("seoKeywords", event.target.value)}
              placeholder="дом, интерьер, Rinart"
            />
          </label>
          <label className={styles.inputGroup}>
            <LabelWithHint
              label="OG Image"
              hint="Изображение для предпросмотра в соцсетях (минимум 1200×630)."
            />
            <div className={styles.ogInputRow}>
              {state.seoOgImageUrl ? (
                <div className={styles.ogPreview}>
                  <div className={styles.heroImageWrap}>
                    <button
                      className={styles.previewDeleteButton}
                      type="button"
                      onClick={() => onFieldChange("seoOgImageUrl", "")}
                      aria-label="Удалить OG изображение"
                    >
                      <IconX aria-hidden="true" />
                    </button>
                    <SafeImage
                      src={state.seoOgImageUrl}
                      alt="Предпросмотр OG"
                      width={640}
                      height={360}
                      unoptimized
                    />
                  </div>
                </div>
              ) : (
                <div className={styles.ogEmpty}>Изображение не выбрано</div>
              )}
              <button className={`${styles.secondaryButton} ${styles.ogPickerButton}`} type="button" onClick={onOpenOgImagePicker}>
                Выбрать из библиотеки
              </button>
            </div>
          </label>
        </div>
      </section>

    </div>
  );
}

function MediaPanel({
  state,
  updateField,
  removeGalleryItem,
  onOpenLibrary,
  onGalleryDragStart,
  onGalleryDragOver,
  onGalleryDragEnd,
  onGalleryDragCancel,
  galleryActiveDragId,
  sensors,
  onSave,
  onDelete,
  saving,
  deleting,
}: {
  state: EditorState;
  updateField: EditorFieldChangeHandler;
  removeGalleryItem: (id: string) => void;
  onOpenLibrary: (mode: MediaLibraryMode, config?: { targetId?: string; initialSelection?: string[] }) => void;
  onGalleryDragStart: (event: DragStartEvent) => void;
  onGalleryDragOver: (event: DragOverEvent) => void;
  onGalleryDragEnd: (event: DragEndEvent) => void;
  onGalleryDragCancel: () => void;
  galleryActiveDragId: string | null;
  sensors: ReturnType<typeof useSensors>;
  onSave: () => Promise<void>;
  onDelete: () => void | Promise<void>;
  saving: boolean;
  deleting: boolean;
}) {
  const handleHeroClear = () => updateField("heroImageUrl", "");
  const galleryEmpty = state.gallery.length === 0;

  return (
    <div className={styles.mediaStack}>
      <div className={styles.sectionActions} style={{ marginBottom: "24px" }}>
        {state.slug ? (
          <a
            href={`/${state.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.secondaryButton}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
              paddingTop: "12px",
              paddingBottom: "12px",
              paddingLeft: "12px",
              paddingRight: "12px",
              boxSizing: "border-box",
              lineHeight: "1",
            }}
            title="Просмотреть страницу проекта"
            aria-label="Просмотреть страницу проекта"
          >
            <IconExternalLink style={{ width: "16px", height: "16px", display: "block", flexShrink: 0 }} />
          </a>
        ) : null}
        <button 
          className={styles.primaryButton} 
          type="button" 
          onClick={onSave} 
          disabled={saving || deleting}
        >
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
        <button
          type="button"
          onClick={() => onDelete()}
          disabled={saving || deleting}
          aria-label={deleting ? "Удаление..." : "Удалить проект"}
          title={deleting ? "Удаление..." : "Удалить проект"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "8px 12px",
            background: saving || deleting ? "#fee2e2" : "#fecaca",
            border: "none",
            borderRadius: "6px",
            cursor: saving || deleting ? "not-allowed" : "pointer",
            color: saving || deleting ? "#9ca3af" : "#dc2626",
            opacity: saving || deleting ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            if (!saving && !deleting) {
              e.currentTarget.style.backgroundColor = "#fca5a5";
            }
          }}
          onMouseLeave={(e) => {
            if (!saving && !deleting) {
              e.currentTarget.style.backgroundColor = "#fecaca";
            }
          }}
        >
          <IconTrash aria-hidden="true" width={20} height={20} />
        </button>
      </div>
      <section className={styles.mediaSection}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleRow}>
            <h3 className={styles.sectionTitle}>Главное изображение</h3>
            <FieldHint text="Будет использоваться в карточке проекта и на главной странице." />
          </div>
          <p className={styles.sectionSubtitle}>Отображается на карточке проекта и в списках.</p>
          <div className={styles.sectionActions}>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() =>
                onOpenLibrary("hero", { initialSelection: state.heroImageUrl ? [state.heroImageUrl] : [] })
              }
            >
              Выбрать из библиотеки
            </button>
          </div>
        </div>
        <div className={styles.heroPreview}>
          {state.heroImageUrl ? (
            <div className={styles.heroImageWrap}>
              <button
                className={styles.previewDeleteButton}
                type="button"
                onClick={handleHeroClear}
                aria-label="Удалить главное изображение"
              >
                <IconX aria-hidden="true" />
              </button>
              <SafeImage src={state.heroImageUrl} alt="Главное изображение проекта" width={640} height={400} />
            </div>
          ) : (
            <div className={styles.heroPlaceholder}>Изображение не выбрано</div>
          )}
        </div>
        <p className={styles.mediaHint}>Выберите изображение из медиа-библиотеки.</p>
      </section>

      <section className={styles.mediaSection}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleRow}>
            <h3 className={styles.sectionTitle}>Галерея проекта</h3>
            <FieldHint text="Добавьте визуалы и схемы. Они появятся в галерее проекта на сайте." />
          </div>
          <p className={styles.sectionSubtitle}>Выберите несколько изображений из медиа-библиотеки.</p>
          <div className={styles.sectionActions}>
            <button className={styles.secondaryButton} type="button" onClick={() => onOpenLibrary("gallery-add")}>
              Добавить из библиотеки
            </button>
          </div>
        </div>
        {galleryEmpty ? (
          <div className={styles.emptyState}>
            Пока галерея пуста. Добавьте изображения из медиа-библиотеки.
          </div>
        ) : (
          <DndContext
            accessibility={PROJECTS_DND_ACCESSIBILITY}
            sensors={sensors}
            collisionDetection={pointerWithin}
            modifiers={[restrictToVerticalAxis]}
            onDragStart={onGalleryDragStart}
            onDragOver={onGalleryDragOver}
            onDragEnd={onGalleryDragEnd}
            onDragCancel={onGalleryDragCancel}
          >
            <SortableContext items={state.gallery.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <div className={styles.galleryList}>
                {state.gallery.map((item, index) => (
                  <SortableGalleryItem
                    key={item.id}
                    item={item}
                    index={index}
                    onRemove={removeGalleryItem}
                    onReplace={(id) =>
                      onOpenLibrary("gallery-replace", {
                        targetId: id,
                        initialSelection: item.url ? [item.url] : [],
                      })
                    }
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {galleryActiveDragId ? (
                (() => {
                  const draggingItem = state.gallery.find((item) => item.id === galleryActiveDragId);
                  if (!draggingItem) return null;
                  const index = state.gallery.findIndex((item) => item.id === galleryActiveDragId);
                  return <GalleryItemCard item={draggingItem} index={index} />;
                })()
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </section>

    </div>
  );
}

type SettingsViewProps = {
  contactSettings: ContactSettingsState;
  socialLinks: SocialLinkState[];
  onContactChange: (field: keyof ContactSettingsState, value: string) => void;
  onSocialChange: (id: string, field: keyof SocialLinkState, value: string | SocialPlatformOption) => void;
  onSaveContacts: () => void;
  onSaveSocials: () => void;
  settingsLoading: boolean;
  settingsSaving: boolean;
  appearanceSettings: AppearanceSettingsState;
  appearanceLoading: boolean;
  appearanceSaving: boolean;
  onAppearanceChange: (field: keyof AppearanceSettingsState, value: string) => void;
  onSaveAppearance: () => void;
  teamMembers: TeamMemberState[];
  teamLoading: boolean;
  teamSelectedId: number | null;
  teamEditor: TeamEditorState;
  onTeamSelect: (id: number) => void;
  onTeamFieldChange: (field: keyof TeamMemberState, value: string | boolean) => void;
  onTeamSave: () => void;
  onTeamDelete: () => void;
  onTeamCreate: () => void;
  onTeamDragStart: (event: DragStartEvent) => void;
  onTeamDragOver: (event: DragOverEvent) => void;
  onTeamDragEnd: (event: DragEndEvent) => void;
  onTeamDragCancel: () => void;
  teamSaving: boolean;
  teamDeleting: boolean;
  teamLoaded: boolean;
  sensors: ReturnType<typeof useSensors>;
  teamCreateModalOpen: boolean;
  onCloseCreateModal: () => void;
  onCreateTeamMember: (payload: { name: string; role?: string }) => void;
  activeTeamMember: TeamMemberState | null;
  onOpenMediaLibrary: (mode: MediaLibraryMode, options?: { targetId?: string; initialSelection?: string[] }) => void;
};

// Settings view removed
function SettingsView({
  contactSettings,
  socialLinks,
  onContactChange,
  onSocialChange,
  onSaveContacts,
  onSaveSocials,
  settingsLoading,
  settingsSaving,
  appearanceSettings,
  appearanceLoading,
  appearanceSaving,
  onAppearanceChange,
  onSaveAppearance,
  teamMembers,
  teamLoading,
  teamSelectedId,
  teamEditor,
  onTeamSelect,
  onTeamFieldChange,
  onTeamSave,
  onTeamDelete,
  onTeamCreate,
  onTeamDragStart,
  onTeamDragOver,
  onTeamDragEnd,
  onTeamDragCancel,
  teamSaving,
  teamDeleting,
  teamLoaded,
  sensors,
  teamCreateModalOpen,
  onCloseCreateModal,
  onCreateTeamMember,
  activeTeamMember,
  onOpenMediaLibrary,
}: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("contacts");

  const handleContactsSubmit = (event: ReactFormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSaveContacts();
  };

  const handleSocialSubmit = (event: ReactFormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSaveSocials();
  };

  const handleAppearanceSubmit = (event: ReactFormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSaveAppearance();
  };

  const renderContactsPanel = () => (
    <form className={styles.settingsPanel} onSubmit={handleContactsSubmit}>
      <div className={styles.settingsCard}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>Контент сайта</p>
            <h2 className={styles.columnTitle}>Контакты</h2>
            <p className={styles.columnSubtitle}>Настройте телефон, email, адрес и CTA в подвале.</p>
          </div>
        </div>
        <div className={`${styles.formGrid} ${styles.gridTwo}`}>
          <label className={styles.inputGroup}>
            <LabelWithHint
              label="Телефон"
              hint="Номер будет показан в подвале и на странице контактов."
            />
            <input
              className={styles.textInput}
              value={contactSettings.phoneLabel}
              onChange={(event) => onContactChange("phoneLabel", event.target.value)}
              disabled={settingsLoading}
              placeholder="+7 000 000-00-00"
            />
          </label>
          <label className={styles.inputGroup}>
            <LabelWithHint
              label="Email"
              hint="Почта для обратной связи. Используется в контактах и подвале."
            />
            <input
              className={styles.textInput}
              value={contactSettings.emailLabel}
              onChange={(event) => onContactChange("emailLabel", event.target.value)}
              disabled={settingsLoading}
              placeholder="hello@rinart.pro"
            />
          </label>
        </div>
        <div className={`${styles.formGrid} ${styles.gridTwo}`}>
          <label className={styles.inputGroup}>
            <LabelWithHint
              label="CTA WhatsApp"
              hint="Текст кнопки для связи через WhatsApp (например «Написать в WhatsApp»)."
            />
            <input
              className={styles.textInput}
              value={contactSettings.whatsappLabel}
              onChange={(event) => onContactChange("whatsappLabel", event.target.value)}
              disabled={settingsLoading}
            />
          </label>
          <label className={styles.inputGroup}>
            <LabelWithHint
              label="Ссылка WhatsApp"
              hint="Ссылка формата https://wa.me/номер для открытия чата."
            />
            <input
              className={styles.textInput}
              value={contactSettings.whatsappUrl}
              onChange={(event) => onContactChange("whatsappUrl", event.target.value)}
              disabled={settingsLoading}
            />
          </label>
        </div>
        <div className={`${styles.formGrid} ${styles.gridTwo}`}>
          <label className={styles.inputGroup}>
            <LabelWithHint
              label="Город в подвале"
              hint="Краткий указатель города/локации в подвале сайта."
            />
            <input
              className={styles.textInput}
              value={contactSettings.cityLabel}
              onChange={(event) => onContactChange("cityLabel", event.target.value)}
              disabled={settingsLoading}
            />
          </label>
          <label className={styles.inputGroup}>
            <LabelWithHint
              label="Адрес / локация"
              hint="Произвольный адрес или описание локации, показывается в контактах."
            />
            <input
              className={styles.textInput}
              value={contactSettings.locationLabel}
              onChange={(event) => onContactChange("locationLabel", event.target.value)}
              disabled={settingsLoading}
            />
          </label>
        </div>
        <div className={styles.mediaSection}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleRow}>
              <h3 className={styles.sectionTitle}>Изображение героя</h3>
              <FieldHint text="Изображение, показываемое на странице контактов." />
            </div>
            <p className={styles.sectionSubtitle}>Отображается справа от контактной информации.</p>
            <div className={styles.sectionActions}>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() =>
                  onOpenMediaLibrary("contact-hero", {
                    initialSelection: contactSettings.heroImageUrl ? [contactSettings.heroImageUrl] : [],
                  })
                }
              >
                Выбрать из библиотеки
              </button>
            </div>
          </div>
          <div className={styles.heroPreview}>
            {contactSettings.heroImageUrl ? (
              <div className={styles.heroImageWrap}>
                <button
                  className={styles.previewDeleteButton}
                  type="button"
                  onClick={() => onContactChange("heroImageUrl", "")}
                  aria-label="Удалить изображение"
                >
                  <IconX aria-hidden="true" />
                </button>
                <SafeImage
                  src={contactSettings.heroImageUrl}
                  alt="Изображение героя контактов"
                  width={640}
                  height={400}
                />
              </div>
            ) : (
              <div className={styles.heroPlaceholder}>Изображение не выбрано</div>
            )}
          </div>
          <p className={styles.mediaHint}>Выберите изображение из медиа-библиотеки.</p>
        </div>
      </div>
      <div className={styles.settingsActions}>
        <button className={styles.primaryButton} type="submit" disabled={settingsSaving || settingsLoading}>
          {settingsSaving ? "Сохраняем..." : "Сохранить контакты"}
        </button>
      </div>
    </form>
  );

  const renderSocialPanel = () => (
    <form className={styles.settingsPanel} onSubmit={handleSocialSubmit}>
      <div className={styles.settingsCard}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>Коммуникации</p>
            <h2 className={styles.columnTitle}>Социальные сети</h2>
            <p className={styles.columnSubtitle}>Ссылки используются в шапке, подвале и на странице контактов.</p>
          </div>
        </div>
        <div className={styles.socialGrid}>
          {socialLinks.map((link) => {
            const platformKey = `socialIcon${link.platform.charAt(0).toUpperCase()}${link.platform.slice(1)}` as keyof typeof styles;
            const platformClass = styles[platformKey] ?? "";
            const platformLabel =
              SOCIAL_PLATFORM_OPTIONS.find((option) => option.value === link.platform)?.label ?? link.platform.toUpperCase();
            return (
              <div key={link.id} className={styles.socialCard}>
                <div className={styles.socialCardHeader}>
                  <div className={styles.socialIconPreview}>
                    <span className={`${styles.socialIconBadge} ${platformClass}`} aria-hidden="true" />
                  </div>
                  <div className={styles.socialPlatformMeta}>
                    <span className={styles.socialPlatformLabel}>{platformLabel}</span>
                    <span className={styles.socialPlatformHint}>Фиксированная иконка</span>
                  </div>
                </div>
                <div className={styles.socialFields}>
                  <label className={styles.inputGroup}>
                    <LabelWithHint
                      label="Текст ссылки"
                      hint="Подпись для кнопки/ссылки соцсети. Например: «Мы в Telegram»."
                    />
                    <input
                      className={styles.textInput}
                      value={link.label}
                      onChange={(event) => onSocialChange(link.id, "label", event.target.value)}
                      disabled={settingsLoading}
                    />
                  </label>
                  <label className={styles.inputGroup}>
                    <LabelWithHint
                      label="URL"
                      hint="Адрес страницы вашей соцсети. Например: https://t.me/ваш_канал"
                    />
                    <input
                      className={styles.textInput}
                      value={link.url}
                      onChange={(event) => onSocialChange(link.id, "url", event.target.value)}
                      disabled={settingsLoading}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className={styles.settingsActions}>
        <button className={styles.primaryButton} type="submit" disabled={settingsSaving || settingsLoading}>
          {settingsSaving ? "Сохраняем..." : "Сохранить ссылки"}
        </button>
      </div>
    </form>
  );

  const renderMediaPanel = () => (
    <form className={styles.settingsPanel} onSubmit={handleAppearanceSubmit}>
      <div className={styles.settingsCard}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>Визуальный стиль</p>
            <h2 className={styles.columnTitle}>Медиа сайта</h2>
            <p className={styles.columnSubtitle}>Задайте фон главного экрана и логотип для переходов между страницами.</p>
          </div>
        </div>
        <div className={styles.appearanceGrid}>
          <div className={styles.appearanceItem}>
              <LabelWithHint
                label="Изображение на главной странице"
                hint="Фоновая картинка в шапке главной страницы. Выберите из медиа‑библиотеки."
              />
              <div className={styles.sectionActions}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() =>
                    onOpenMediaLibrary("site-hero", {
                      initialSelection: appearanceSettings.homeHeroImageUrl ? [appearanceSettings.homeHeroImageUrl] : [],
                    })
                  }
                >
                  Выбрать из библиотеки
                </button>
              </div>
            <div className={styles.appearancePreview}>
              {appearanceSettings.homeHeroImageUrl ? (
                <SafeImage 
                  key={appearanceSettings.homeHeroImageUrl}
                  src={appearanceSettings.homeHeroImageUrl} 
                  alt="Предпросмотр главного экрана" 
                  width={640} 
                  height={400}
                />
              ) : (
                <span className={styles.appearancePlaceholder}>Предпросмотр недоступен</span>
              )}
            </div>
          </div>
          <div className={styles.appearanceItem}>
              <LabelWithHint
                label="Изображение перехода между страницами"
                hint="Логотип/картинка, которая кратко отображается при переходах. Выберите из медиа‑библиотеки."
              />
              <div className={styles.sectionActions}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() =>
                    onOpenMediaLibrary("site-transition", {
                      initialSelection: appearanceSettings.transitionImageUrl ? [appearanceSettings.transitionImageUrl] : [],
                    })
                  }
                >
                  Выбрать из библиотеки
                </button>
              </div>
            <div className={styles.appearancePreview}>
              {appearanceSettings.transitionImageUrl ? (
                <SafeImage 
                  key={appearanceSettings.transitionImageUrl}
                  src={appearanceSettings.transitionImageUrl} 
                  alt="Предпросмотр перехода" 
                  width={640} 
                  height={400}
                />
              ) : (
                <span className={styles.appearancePlaceholder}>Предпросмотр недоступен</span>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className={styles.settingsActions}>
        <button className={styles.primaryButton} type="submit" disabled={appearanceSaving || appearanceLoading}>
          {appearanceSaving ? "Сохраняем..." : "Сохранить медиа"}
        </button>
      </div>
    </form>
  );

  return (
    <div className={styles.settingsHub}>
      <div className={styles.settingsIntro}>
        <div>
          <p className={styles.sectionEyebrow}>Контент</p>
          <h2 className={styles.columnTitle}>Глобальные блоки сайта</h2>
          <p className={styles.columnSubtitle}>Выберите вкладку, чтобы редактировать данные и сохранить изменения точечно.</p>
        </div>
      </div>
      <div className={styles.settingsLayout}>
        <nav className={styles.settingsNav} aria-label="Разделы контента">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              className={styles.settingsNavButton}
              type="button"
              data-active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className={styles.settingsNavLabel}>{tab.label}</span>
              <span className={styles.settingsNavDescription}>{tab.description}</span>
            </button>
          ))}
        </nav>
        <div className={styles.settingsContent}>
          {activeTab === "contacts"
            ? renderContactsPanel()
            : activeTab === "social"
              ? renderSocialPanel()
              : activeTab === "media"
                ? renderMediaPanel()
                : (
                  <div className={styles.teamSectionWrapper}>
                    <div className={styles.teamSectionCard}>
                      <TeamManager
                        members={teamMembers}
                        loading={teamLoading}
                        selectedId={teamSelectedId}
                        editor={teamEditor}
                        onSelect={onTeamSelect}
                        onFieldChange={onTeamFieldChange}
                        onSave={onTeamSave}
                        onDelete={onTeamDelete}
                        onCreate={onTeamCreate}
                        onDragStart={onTeamDragStart}
                        onDragOver={onTeamDragOver}
                        onDragEnd={onTeamDragEnd}
                        onDragCancel={onTeamDragCancel}
                        saving={teamSaving}
                        deleting={teamDeleting}
                        sensors={sensors}
                        loaded={teamLoaded}
                        activeDragMember={activeTeamMember}
                        onOpenMediaLibrary={onOpenMediaLibrary}
                      />
                    </div>
                  </div>
                )}
        </div>
      </div>
      {teamCreateModalOpen ? (
        <CreateTeamMemberModal onClose={onCloseCreateModal} onCreate={onCreateTeamMember} />
      ) : null}
    </div>
  );
}

function TeamManager({
  members,
  loading,
  selectedId,
  editor,
  onSelect,
  onFieldChange,
  onSave,
  onDelete,
  onCreate,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDragCancel,
  saving,
  deleting,
  sensors,
  loaded,
  activeDragMember,
  onOpenMediaLibrary,
}: {
  members: TeamMemberState[];
  loading: boolean;
  selectedId: number | null;
  editor: TeamEditorState;
  onSelect: (id: number) => void;
  onFieldChange: (field: keyof TeamMemberState, value: string | boolean) => void;
  onSave: () => void;
  onDelete: () => void;
  onCreate: () => void;
  onDragStart: (event: DragStartEvent) => void;
  onDragOver: (event: DragOverEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: () => void;
  saving: boolean;
  deleting: boolean;
  sensors: ReturnType<typeof useSensors>;
  loaded: boolean;
  activeDragMember: TeamMemberState | null;
  onOpenMediaLibrary?: (mode: MediaLibraryMode, options?: { targetId?: string; initialSelection?: string[] }) => void;
}) {
  return (
    <div className={styles.teamLayout}>
      <aside className={styles.projectColumn}>
        <div className={styles.projectColumnHeader}>
          <div>
            <h2 className={styles.columnTitle}>Команда</h2>
            <p className={styles.columnSubtitle}>Перетаскивайте карточки, чтобы менять порядок на странице.</p>
          </div>
          <button className={styles.primaryButton} type="button" onClick={onCreate} disabled={loading}>
            Добавить
          </button>
        </div>
        <div className={styles.projectColumnBody}>
          <div className={styles.projectList} suppressHydrationWarning>
            {loading && !loaded ? (
              <ProjectListSkeleton />
            ) : members.length ? (
              (typeof window !== "undefined") ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragEnd={onDragEnd}
                onDragCancel={onDragCancel}
              >
                <SortableContext items={members.map((member) => member.id)} strategy={verticalListSortingStrategy}>
                  {members.map((member, index) => (
                    <SortableTeamItem
                      key={member.id}
                      member={member}
                      index={index}
                      isActive={member.id === selectedId}
                      onSelect={onSelect}
                    />
                  ))}
                </SortableContext>
                <DragOverlay>
                  {activeDragMember ? (
                    <TeamListCard
                      member={activeDragMember}
                      index={Math.max(0, members.findIndex((item) => item.id === activeDragMember.id))}
                    />
                  ) : null}
                </DragOverlay>
              </DndContext>
              ) : null
            ) : (
              <div className={styles.emptyState}>Добавьте участников, чтобы показать их на странице.</div>
            )}
          </div>
        </div>
      </aside>
      <main className={styles.editorColumn}>
        {loading && !editor ? (
          <EditorSkeleton />
        ) : editor ? (
          <TeamEditorPanel
            member={editor}
            onFieldChange={onFieldChange}
            onSave={onSave}
            onDelete={onDelete}
            saving={saving}
            deleting={deleting}
            onPickDesktopImage={
              onOpenMediaLibrary
                ? () =>
                    onOpenMediaLibrary("team-image", {
                      initialSelection: editor.imageUrl ? [editor.imageUrl] : [],
                    })
                : undefined
            }
            onPickMobileImage={
              onOpenMediaLibrary
                ? () =>
                    onOpenMediaLibrary("team-mobile-image", {
                      initialSelection: editor.mobileImageUrl ? [editor.mobileImageUrl] : [],
                    })
                : undefined
            }
          />
        ) : (
          <div className={styles.emptyState}>Выберите участника команды для редактирования.</div>
        )}
      </main>
    </div>
  );
}

function SortableTeamItem({
  member,
  index,
  isActive,
  onSelect,
}: {
  member: TeamMemberState;
  index: number;
  isActive: boolean;
  onSelect: (id: number) => void;
}) {
  const { listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: member.id,
  });
  const { onPointerDown: sortablePointerDown, ...otherListeners } = listeners ?? {};

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
    animationDelay: `${Math.min(index, 10) * 50}ms`,
  };

  return (
    <article
      ref={setNodeRef}
      className={`${styles.projectListItem} ${styles.fadeInItem}`}
      data-active={isActive}
      data-dragging={isDragging}
      style={style}
      onClick={() => onSelect(member.id)}
    >
      <div className={styles.projectRow}>
        <button
          className={styles.dragHandle}
          type="button"
          aria-label={`Перетащить ${member.name}`}
          ref={setActivatorNodeRef}
          {...otherListeners}
          onPointerDown={(event) => {
            sortablePointerDown?.(event);
            if (!event.defaultPrevented) {
              event.stopPropagation();
            }
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <span className={styles.dragIcon} aria-hidden="true" />
        </button>
          {member.imageUrl ? (
            <div style={{ width: 48, height: 48, marginRight: 12, borderRadius: 6, overflow: "hidden", flex: "0 0 auto" }}>
              <SafeImage src={member.imageUrl} alt={member.name} width={48} height={48} />
            </div>
          ) : null}
        <div className={styles.projectMeta}>
          <div className={styles.projectTitleRow}>
            <span className={styles.projectOrder}>{String(index + 1).padStart(2, "0")}</span>
            <h4 className={styles.projectListTitle}>{member.name}</h4>
          </div>
          {member.role ? <p className={styles.projectListMeta}>{member.role}</p> : null}
        </div>
      </div>
    </article>
  );
}

function TeamListCard({ member, index }: { member: TeamMemberState; index: number }) {
  const cardStyle: React.CSSProperties = { animationDelay: `${Math.min(index, 10) * 50}ms` };
  return (
    <article className={`${styles.projectListItem} ${styles.fadeInItem}`} style={cardStyle}>
      <div className={styles.projectRow}>
        <div className={`${styles.dragHandle} ${styles.dragHandleStatic}`}>
          <span className={styles.dragIcon} aria-hidden="true" />
        </div>
        {member.imageUrl ? (
          <div style={{ width: 48, height: 48, marginRight: 12, borderRadius: 6, overflow: "hidden", flex: "0 0 auto" }}>
            <Image src={member.imageUrl} alt={member.name} width={48} height={48} unoptimized />
          </div>
        ) : null}
        <div className={styles.projectMeta}>
          <div className={styles.projectTitleRow}>
            <span className={styles.projectOrder}>{String(index + 1).padStart(2, "0")}</span>
            <h4 className={styles.projectListTitle}>{member.name}</h4>
          </div>
          {member.role ? <p className={styles.projectListMeta}>{member.role}</p> : null}
        </div>
      </div>
    </article>
  );
}

function TeamEditorPanel({
  member,
  onFieldChange,
  onSave,
  onDelete,
  saving,
  deleting,
  onPickDesktopImage,
  onPickMobileImage,
}: {
  member: TeamMemberState;
  onFieldChange: (field: keyof TeamMemberState, value: string | boolean) => void;
  onSave: () => void;
  onDelete: () => void;
  saving: boolean;
  deleting: boolean;
  onPickDesktopImage?: () => void;
  onPickMobileImage?: () => void;
}) {
  return (
    <div className={styles.editorStack}>
      <section className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionTitle}>Карточка участника</h3>
            <p className={styles.sectionSubtitle}>Имя, роль и подпись для десктопной версии.</p>
          </div>
        </div>
        <div className={`${styles.formGrid} ${styles.gridTwo}`}>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Имя</span>
            <input
              className={styles.textInput}
              value={member.name}
              onChange={(event) => onFieldChange("name", event.target.value)}
            />
          </label>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Подпись (desktop)</span>
            <input
              className={styles.textInput}
              value={member.label}
              onChange={(event) => onFieldChange("label", event.target.value)}
            />
          </label>
        </div>
        <label className={styles.inputGroup}>
          <span className={styles.inputLabel}>Роль / описание</span>
          <input
            className={styles.textInput}
            value={member.role}
            onChange={(event) => onFieldChange("role", event.target.value)}
          />
        </label>
      </section>
      <section className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionTitle}>Фотография</h3>
            <p className={styles.sectionSubtitle}>Предпросмотр и выбор изображения участника.</p>
          </div>
        </div>
        <div className={styles.heroPreview}>
          {member.imageUrl ? (
            <div className={styles.heroImageWrap}>
              <SafeImage src={member.imageUrl} alt={member.name} width={640} height={400} />
            </div>
          ) : (
            <div className={styles.heroPlaceholder}>Изображение не выбрано</div>
          )}
        </div>
              <div className={styles.sectionActions}>
          {onPickDesktopImage ? (
                <button type="button" className={styles.secondaryButton} onClick={onPickDesktopImage}>
                  Выбрать из библиотеки
                </button>
            ) : null}
          {member.imageUrl ? (
            <button
              type="button"
              className={styles.ghostButton}
              onClick={() => onFieldChange("imageUrl", "")}
            >
              Удалить фото
                </button>
            ) : null}
        </div>
      </section>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={member.isFeatured}
            onChange={(event) => onFieldChange("isFeatured", event.target.checked)}
          />
          <span>Показывать как главное фото (крупный портрет)</span>
        </label>
      <div className={styles.saveBar}>
        <button className={styles.primaryButton} type="button" onClick={onSave} disabled={saving || deleting}>
          {saving ? "Сохраняем..." : "Сохранить"}
        </button>
        <button className={styles.dangerButton} type="button" onClick={onDelete} disabled={saving || deleting}>
          {deleting ? "Удаляем..." : "Удалить"}
        </button>
      </div>
    </div>
  );
}

function CreateTeamMemberModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (payload: { name: string; role?: string }) => Promise<void> | void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }
    await onCreate({ name: name.trim(), role: role.trim() || undefined });
    setName("");
    setRole("");
  };

  return (
    <div className={styles.createModalOverlay} role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className={styles.createModal}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <header className={styles.createModalHeader}>
          <div>
            <h3 className={styles.createModalTitle}>Новый участник</h3>
            <p className={styles.createModalSubtitle}>Укажите имя и роль. Остальные поля можно заполнить позже.</p>
          </div>
          <button className={styles.iconGhostButton} type="button" onClick={onClose} aria-label="Закрыть форму">
            <IconX aria-hidden="true" />
          </button>
        </header>
        <form className={styles.createModalForm} onSubmit={handleSubmit}>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Имя</span>
            <input
              className={styles.textInput}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Например: Ринат Гильмутдинов"
              autoFocus
              required
            />
          </label>
          <label className={styles.inputGroup}>
            <span className={styles.inputLabel}>Роль (опционально)</span>
            <input
              className={styles.textInput}
              value={role}
              onChange={(event) => setRole(event.target.value)}
              placeholder="Архитектор. Руководитель мастерской"
            />
          </label>
          <div className={styles.modalActions}>
            <button className={styles.ghostButton} type="button" onClick={onClose}>
              Отмена
            </button>
            <button className={styles.primaryButton} type="submit" disabled={!name.trim()}>
              Добавить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type MediaLibraryModalProps = {
  assets: MediaAsset[];
  allowMultiple?: boolean;
  initialSelection?: string[];
  onClose: () => void;
  onApply: (assets: MediaAsset[]) => void;
  onCreateAsset: (payload: { url: string; title?: string }) => Promise<MediaAsset>;
  onUploadFile: (file: File) => Promise<MediaAsset>;
  onDeleteAsset: (asset: MediaAsset) => Promise<void>;
};

function MediaLibraryModal({
  assets,
  allowMultiple = false,
  initialSelection = [],
  onClose,
  onApply,
  onCreateAsset,
  onUploadFile,
  onDeleteAsset,
}: MediaLibraryModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelection));
  const [uploading, setUploading] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const visibleAssets = useMemo(() => assets.filter((a) => a.origin === "library"), [assets]);

  useEffect(() => {
    setSelected(new Set(initialSelection));
  }, [initialSelection]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const toggleSelection = (asset: MediaAsset) => {
    setSelected((prev) => {
      const has = prev.has(asset.url);
      if (allowMultiple) {
        const next = new Set(prev);
        if (has) {
          next.delete(asset.url);
        } else {
          next.add(asset.url);
        }
        return next;
      }
      const next = new Set<string>();
      if (!has) {
        next.add(asset.url);
      }
      return next;
    });
  };

  const selectAsset = (asset: MediaAsset) => {
    setSelected((prev) => {
      const next = allowMultiple ? new Set(prev) : new Set<string>();
      next.add(asset.url);
      return next;
    });
  };

  const handleFileInputChange = async (event: ReactChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files).slice(0, 20) : [];
    if (!files.length) {
      return;
    }
    setUploading(true);
    setUploadingCount(files.length);
    setError(null);
    try {
      for (const file of files) {
        try {
          const asset = await onUploadFile(file);
          selectAsset(asset);
          setUploadingCount((prev) => Math.max(0, prev - 1));
        } catch (fileError) {
          setUploadingCount((prev) => Math.max(0, prev - 1));
          const message = fileError instanceof Error && fileError.message ? fileError.message : "Не удалось загрузить файл";
          setError(message);
        }
      }
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "Не удалось загрузить файл";
      setError(message);
    } finally {
      setUploading(false);
      setUploadingCount(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleApplySelection = () => {
    const picked = assets.filter((asset) => selected.has(asset.url));
    onApply(picked);
  };

  return (
    <div className={styles.mediaModalOverlay}>
      <div className={styles.mediaModal}>
        <header className={styles.mediaModalHeader}>
          <div>
            <div className={styles.sectionTitleRow} style={{ marginBottom: "8px" }}>
              <h3 className={styles.mediaModalTitle}>Библиотека медиа</h3>
              <FieldHint text="Загруженные изображения автоматически конвертируются в формат AVIF (или WebP) для быстрой загрузки на сайте." />
            </div>
            <p className={styles.mediaModalSubtitle}>
              Загрузите изображение или добавьте ссылку. Выбранные элементы отображаются справа.
            </p>
          </div>
          <button className={styles.iconGhostButton} type="button" onClick={onClose} aria-label="Закрыть">
            <IconX aria-hidden="true" />
          </button>
        </header>

        <div className={styles.mediaModalBody}>
          <aside className={styles.mediaModalSidebar}>
            <div className={styles.uploadWidget}>
              <label className={styles.uploadLabel}>
                <input
                  ref={fileInputRef}
                  className={styles.uploadInput}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileInputChange}
                  disabled={uploading}
                />
                {uploading
                  ? uploadingCount > 0
                    ? (() => {
                        const fileWord = uploadingCount === 1 ? "файл" : uploadingCount < 5 ? "файла" : "файлов";
                        return `Конвертация... (${uploadingCount} ${fileWord})`;
                      })()
                    : "Загрузка..."
                  : "Загрузить файлы"}
              </label>
              <p className={styles.uploadHint}>Поддерживаются JPG, PNG, WEBP, GIF до 15 МБ. Можно выбрать до 20 файлов за раз.</p>
            </div>
            {error ? <p className={styles.modalError}>{error}</p> : null}
            <p className={styles.modalHint}>
              Изображения, загруженные сюда, появляются в библиотеке и доступны для всех проектов.
            </p>
          </aside>

          <div className={styles.mediaModalContent}>
            <div className={styles.mediaModalGrid}>
              {uploadingCount > 0
                ? Array.from({ length: uploadingCount }).map((_, index) => (
                    <MediaLibraryItemSkeleton key={`uploading-skeleton-${index}`} />
                  ))
                : null}
              {visibleAssets.length ? (
                visibleAssets.map((asset) => {
                  const isSelected = selected.has(asset.url);
                  return (
                    <div key={asset.id} className={`${styles.mediaModalItem} ${isSelected ? styles.mediaModalItemSelected : ""}`}>
                      <button
                        type="button"
                        className={styles.mediaModalSelectable}
                        onClick={() => toggleSelection(asset)}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/uri-list", asset.url);
                          event.dataTransfer.setData("text/plain", asset.url);
                          event.dataTransfer.effectAllowed = "copy";
                        }}
                        aria-label={`Выбрать ${asset.title}`}
                      >
                        <div className={styles.mediaModalPreview}>
                          <ModalImage src={asset.url} alt={asset.title || "Медиа"} width={200} height={200} />
                        </div>
                        <span className={styles.mediaModalItemTitle}>{asset.title}</span>
                      </button>
                      {asset.origin === "library" ? (
                        <button
                          type="button"
                          className={styles.mediaModalDelete}
                          aria-label="Удалить из библиотеки"
                          onClick={async (e) => {
                            e.stopPropagation();
                            setDeletingId(asset.id);
                            try {
                              await onDeleteAsset(asset);
                            } finally {
                              setDeletingId((prev) => (prev === asset.id ? null : prev));
                            }
                          }}
                          disabled={deletingId === asset.id}
                          title="Удалить из библиотеки"
                        >
                          <IconTrash aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  );
                })
              ) : null}
              {!visibleAssets.length && !uploading && uploadingCount === 0 ? (
                <div className={styles.emptyState}>В библиотеке пока нет изображений.</div>
              ) : null}
            </div>
          </div>
        </div>

        <footer className={styles.mediaModalFooter}>
          <button className={styles.ghostButton} type="button" onClick={onClose}>
            Отмена
          </button>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={handleApplySelection}
            disabled={!selected.size}
          >
            Выбрать {allowMultiple && selected.size ? `(${selected.size})` : ""}
          </button>
        </footer>
      </div>
    </div>
  );
}
