import { fetchAllGlobalBlocks, findGlobalBlockBySlug, upsertGlobalBlock } from "./global-blocks-repository";
import { getAppearanceSettings } from "./site-settings";

export type PricingItem = {
  label: string;
  price: string;
  filledSquares: number;
  connectorHeight: number;
};

export type PricingData = {
  topItems: PricingItem[];
  bottomItems: PricingItem[];
};

export type GlobalBlocks = {
  "home-hero": { imageUrl: string | null };
  "page-transition": { imageUrl: string | null };
  "pricing": PricingData;
};

export async function getGlobalBlocks(): Promise<GlobalBlocks> {
  const all = await fetchAllGlobalBlocks();
  const pick = async (slug: keyof GlobalBlocks) => {
    const record = all.find((r) => r.slug === slug);
    const value = (record?.data ?? {}) as Record<string, unknown>;
    let imageUrl: string | null = typeof value.imageUrl === "string" && value.imageUrl.trim().length ? value.imageUrl.trim() : null;
    
    // Validate file exists for local uploads
    if (imageUrl && imageUrl.startsWith("/uploads/")) {
      try {
        const fs = await import("fs/promises");
        const path = await import("path");
        const filePath = path.join(process.cwd(), "public", imageUrl);
        await fs.access(filePath);
      } catch {
        // File doesn't exist, return null to fall back to default
        imageUrl = null;
      }
    }
    
    return { imageUrl };
  };
  let home = await pick("home-hero");
  let transition = await pick("page-transition");

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

  const pickPricing = (): PricingData => {
    const record = all.find((r) => r.slug === "pricing");
    const value = (record?.data ?? {}) as Record<string, unknown>;
    // Если данные есть в БД и валидны - возвращаем их из БД
    if (value.topItems && Array.isArray(value.topItems) && value.bottomItems && Array.isArray(value.bottomItems)) {
      return {
        topItems: value.topItems as PricingItem[],
        bottomItems: value.bottomItems as PricingItem[],
      };
    }
    // Дефолтные значения только если данных еще нет в БД (первый запуск)
    // После первого сохранения через админку данные будут в БД и будут загружаться оттуда
    return {
      topItems: [
        {
          label: "Эскизный проект \nдома:",
          price: "1500 р/м2",
          filledSquares: 1,
          connectorHeight: 45,
        },
        {
          label: "Конструктивные \nрешения:",
          price: "1000 р/м2",
          filledSquares: 3,
          connectorHeight: 185,
        },
        {
          label: "Проект отопления:",
          price: "300 р/м2",
          filledSquares: 5,
          connectorHeight: 95,
        },
        {
          label: "Дизайн проект интерьера:",
          price: "4000 р/м2",
          filledSquares: 7,
          connectorHeight: 265,
        },
      ],
      bottomItems: [
        {
          label: "Архитектурные \nрешения:",
          price: "1500 р/м2",
          filledSquares: 2,
          connectorHeight: 60,
        },
        {
          label: "Проект водоснабжения \nи канализации:",
          price: "300 р/м2",
          filledSquares: 4,
          connectorHeight: 210,
        },
        {
          label: "Проект электроснабжения:",
          price: "300 р/м2",
          filledSquares: 6,
          connectorHeight: 105,
        },
      ],
    };
  };

  return {
    "home-hero": home,
    "page-transition": transition,
    "pricing": pickPricing(),
  };
}

export async function getGlobalBlock(slug: keyof GlobalBlocks): Promise<GlobalBlocks[typeof slug]> {
  if (slug === "pricing") {
    const all = await fetchAllGlobalBlocks();
    const record = all.find((r) => r.slug === "pricing");
    const value = (record?.data ?? {}) as Record<string, unknown>;
    if (value.topItems && Array.isArray(value.topItems) && value.bottomItems && Array.isArray(value.bottomItems)) {
      return {
        topItems: value.topItems as PricingItem[],
        bottomItems: value.bottomItems as PricingItem[],
      };
    }
    // Return default if not found
    const blocks = await getGlobalBlocks();
    return blocks.pricing;
  }
  const record = await findGlobalBlockBySlug(slug);
  const value = (record?.data ?? {}) as Record<string, unknown>;
  return {
    imageUrl: typeof value.imageUrl === "string" && value.imageUrl.trim().length ? value.imageUrl.trim() : null,
  };
}

export async function saveGlobalBlock(slug: keyof GlobalBlocks, data: GlobalBlocks[typeof slug]): Promise<GlobalBlocks[typeof slug]> {
  if (slug === "pricing") {
    const pricingData = data as PricingData;
    const sanitized: PricingData = {
      topItems: Array.isArray(pricingData.topItems) ? pricingData.topItems : [],
      bottomItems: Array.isArray(pricingData.bottomItems) ? pricingData.bottomItems : [],
    };
    const saved = await upsertGlobalBlock(slug, sanitized);
    const value = (saved?.data ?? {}) as Record<string, unknown>;
    return {
      topItems: (value.topItems as PricingItem[]) ?? [],
      bottomItems: (value.bottomItems as PricingItem[]) ?? [],
    };
  }
  const imageUrlValue = (data as { imageUrl: string | null }).imageUrl;
  let sanitizedImageUrl: string | null = null;
  
  if (imageUrlValue && typeof imageUrlValue === "string" && imageUrlValue.trim().length) {
    const trimmed = imageUrlValue.trim();
    
    // Validate file exists for local uploads before saving
    if (trimmed.startsWith("/uploads/")) {
      try {
        const fs = await import("fs/promises");
        const path = await import("path");
        const filePath = path.join(process.cwd(), "public", trimmed);
        await fs.access(filePath);
        sanitizedImageUrl = trimmed;
      } catch {
        // File doesn't exist, don't save invalid path
        throw new Error(`Файл не найден: ${trimmed}`);
      }
    } else {
      // External URLs or other paths are allowed
      sanitizedImageUrl = trimmed;
    }
  }
  
  const sanitized: GlobalBlocks[typeof slug] = {
    imageUrl: sanitizedImageUrl,
  };
  const saved = await upsertGlobalBlock(slug, sanitized);
  const value = (saved?.data ?? {}) as Record<string, unknown>;
  return {
    imageUrl: typeof value.imageUrl === "string" && value.imageUrl.trim().length ? value.imageUrl.trim() : null,
  };
}


