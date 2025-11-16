import { fetchAllGlobalBlocks, findGlobalBlockBySlug, upsertGlobalBlock } from "./global-blocks-repository";
import { getAppearanceSettings } from "./site-settings";

export type GlobalBlocks = {
  "home-hero": { imageUrl: string | null };
  "page-transition": { imageUrl: string | null };
};

export async function getGlobalBlocks(): Promise<GlobalBlocks> {
  const all = await fetchAllGlobalBlocks();
  const pick = (slug: keyof GlobalBlocks) => {
    const record = all.find((r) => r.slug === slug);
    const value = (record?.data ?? {}) as Record<string, unknown>;
    return {
      imageUrl: typeof value.imageUrl === "string" && value.imageUrl.trim().length ? value.imageUrl.trim() : null,
    };
  };
  let home = pick("home-hero");
  let transition = pick("page-transition");

  // Seed from legacy appearance settings if blocks are absent
  if (!home.imageUrl || !transition.imageUrl) {
    const appearance = await getAppearanceSettings().catch(() => null);
    if (appearance) {
      if (!home.imageUrl && appearance.homeHeroImageUrl) {
        home = { imageUrl: appearance.homeHeroImageUrl };
        await upsertGlobalBlock("home-hero", home);
      }
      if (!transition.imageUrl && appearance.transitionImageUrl) {
        transition = { imageUrl: appearance.transitionImageUrl };
        await upsertGlobalBlock("page-transition", transition);
      }
    }
  }

  return {
    "home-hero": home,
    "page-transition": transition,
  };
}

export async function getGlobalBlock(slug: keyof GlobalBlocks): Promise<GlobalBlocks[typeof slug]> {
  const record = await findGlobalBlockBySlug(slug);
  const value = (record?.data ?? {}) as Record<string, unknown>;
  return {
    imageUrl: typeof value.imageUrl === "string" && value.imageUrl.trim().length ? value.imageUrl.trim() : null,
  };
}

export async function saveGlobalBlock(slug: keyof GlobalBlocks, data: GlobalBlocks[typeof slug]): Promise<GlobalBlocks[typeof slug]> {
  const sanitized: GlobalBlocks[typeof slug] = {
    imageUrl: data.imageUrl && data.imageUrl.trim().length ? data.imageUrl.trim() : null,
  };
  const saved = await upsertGlobalBlock(slug, sanitized);
  const value = (saved?.data ?? {}) as Record<string, unknown>;
  return {
    imageUrl: typeof value.imageUrl === "string" && value.imageUrl.trim().length ? value.imageUrl.trim() : null,
  };
}


