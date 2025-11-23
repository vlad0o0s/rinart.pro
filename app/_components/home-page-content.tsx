"use client";

import { SafeImage as Image } from "@/components/safe-image";
import { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import styles from "../page.module.css";

type CategoryId = "houses" | "interior" | "art" | "other";

type ActiveCategory = "all" | CategoryId;

type ProjectSummary = {
  slug: string;
  title: string;
  tagline?: string;
  heroImageUrl?: string;
  categories: string[];
};

const CATEGORY_LABELS: Record<CategoryId, string> = {
  houses: "Частные дома",
  interior: "Дизайн интерьеров",
  art: "Арт объекты",
  other: "Иные строения",
};

function normalizeCategories(list: string[]): CategoryId[] {
  const mapping: Record<string, CategoryId> = {
    houses: "houses",
    house: "houses",
    interior: "interior",
    interiors: "interior",
    art: "art",
    other: "other",
    misc: "other",
  };

  return list
    .map((item) => mapping[item as keyof typeof mapping] ?? null)
    .filter(Boolean) as CategoryId[];
}

type HomeProjectsSectionProps = {
  projects: ProjectSummary[];
};

export function HomeProjectsSection({ projects }: HomeProjectsSectionProps) {
  const [activeCategory, setActiveCategory] = useState<ActiveCategory>("all");
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const enrichedProjects = useMemo(() => {
    return projects.map((project) => {
      const categories = normalizeCategories(project.categories);
      return {
        ...project,
        categories,
      };
    });
  }, [projects]);

  const categories = useMemo(() => {
    const counts: Record<CategoryId, number> = {
      houses: 0,
      interior: 0,
      art: 0,
      other: 0,
    };

    enrichedProjects.forEach((project) => {
      project.categories.forEach((category) => {
        counts[category] += 1;
      });
    });

    return [
      { id: "all" as const, label: "Все", count: enrichedProjects.length },
      ...Object.entries(CATEGORY_LABELS).map(([id, label]) => ({
        id: id as CategoryId,
        label,
        count: counts[id as CategoryId] ?? 0,
      })),
    ];
  }, [enrichedProjects]);

  const filteredProjects = useMemo(() => {
    if (activeCategory === "all") {
      return enrichedProjects.map((project) => ({ project, isInactive: false }));
    }
    return enrichedProjects.map((project) => ({
      project,
      isInactive: !project.categories.includes(activeCategory),
    }));
  }, [enrichedProjects, activeCategory]);

  // Детальное логирование для отладки переходов
  useEffect(() => {
    if (!gridRef.current) return;

    const cards = gridRef.current.querySelectorAll(`.${styles.portfolioCard}`);
    
    console.log(`[Transition Debug] Category changed to: ${activeCategory}, Total cards: ${cards.length}`);
    
    cards.forEach((card, index) => {
      if (index < 3) {
        const hasDimmed = card.classList.contains(styles.portfolioCardDimmed);
        const computed = window.getComputedStyle(card);
        
        // Проверяем состояние ДО применения изменений
        console.log(`[Transition Debug] Card ${index} BEFORE state:`, {
          hasDimmedClass: hasDimmed,
          computedOpacity: computed.opacity,
          transitionProperty: computed.transitionProperty,
          transitionDuration: computed.transitionDuration,
          transitionTimingFunction: computed.transitionTimingFunction,
          willChange: computed.willChange
        });
        
        // Проверяем, есть ли transition в computed styles
        const transition = computed.transition || computed.webkitTransition;
        console.log(`[Transition Debug] Card ${index} transition value:`, transition);
        
        // Проверяем изображение
        const image = card.querySelector(`.${styles.portfolioImage}`);
        if (image) {
          const imageComputed = window.getComputedStyle(image);
          console.log(`[Transition Debug] Card ${index} image:`, {
            opacity: imageComputed.opacity,
            transition: imageComputed.transition || imageComputed.webkitTransition,
            transitionDuration: imageComputed.transitionDuration
          });
        }
      }
    });
    
    // Проверяем состояние через небольшую задержку
    setTimeout(() => {
      cards.forEach((card, index) => {
        if (index < 3) {
          const computed = window.getComputedStyle(card);
          console.log(`[Transition Debug] Card ${index} AFTER 50ms:`, {
            opacity: computed.opacity,
            transitionInProgress: computed.transitionProperty !== 'none'
          });
        }
      });
    }, 50);
    
    // Проверяем состояние после завершения перехода
    setTimeout(() => {
      cards.forEach((card, index) => {
        if (index < 3) {
          const computed = window.getComputedStyle(card);
          console.log(`[Transition Debug] Card ${index} AFTER 900ms (should be complete):`, {
            opacity: computed.opacity,
            finalState: card.classList.contains(styles.portfolioCardDimmed) ? 'dimmed' : 'active'
          });
        }
      });
    }, 900);
  }, [activeCategory, filteredProjects]);

  const showSkeleton = enrichedProjects.length === 0;

  const toggleMobileCategories = () => {
    setMobileCategoriesOpen((prev) => !prev);
  };

  const handleCategorySelect = (categoryId: ActiveCategory) => {
    console.log(`[Transition Debug] ===== CATEGORY SELECTED =====`);
    console.log(`[Transition Debug] From: ${activeCategory} -> To: ${categoryId}`);
    
    // Проверяем текущее состояние элементов перед изменением
    if (gridRef.current) {
      const cards = gridRef.current.querySelectorAll(`.${styles.portfolioCard}`);
      console.log(`[Transition Debug] Current state before change:`, {
        totalCards: cards.length,
        firstCardHasDimmed: cards[0]?.classList.contains(styles.portfolioCardDimmed),
        firstCardOpacity: window.getComputedStyle(cards[0] || document.body).opacity
      });
    }
    
    setActiveCategory(categoryId);
    setMobileCategoriesOpen(false);
  };

  const activeCategoryLabel = useMemo(() => {
    const current = categories.find((category) => category.id === activeCategory);
    return current?.label ?? categories[0]?.label ?? "";
  }, [activeCategory, categories]);

  return (
    <section className={styles.portfolioSection} id="portfolio">
      <div className={styles.categoryHeader}>
        {showSkeleton ? (
          <>
            <div className={styles.categorySkeletonMobile}>
              <span className={`${styles.skeleton} ${styles.categorySkeletonButton}`} />
            </div>
            <div className={styles.categorySkeletonList}>
              {Array.from({ length: 4 }).map((_, index) => (
                <span key={`category-skeleton-${index}`} className={`${styles.skeleton} ${styles.categorySkeletonChip}`} />
              ))}
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              className={styles.mobileCategoryButton}
              onClick={toggleMobileCategories}
              aria-expanded={mobileCategoriesOpen}
            >
              <span>{activeCategoryLabel}</span>
              <span className={styles.mobileCategoryIcon} aria-hidden />
            </button>

            <div
              className={`${styles.categoryList} ${mobileCategoriesOpen ? styles.categoryListOpen : ""}`}
              role="tablist"
            >
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={`${styles.categoryButton} ${
                    category.id === activeCategory ? styles.categoryButtonActive : ""
                  }`}
                  onClick={() => handleCategorySelect(category.id)}
                >
                  {category.label}
                  <sup>{category.count}</sup>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className={styles.portfolioGrid} ref={gridRef}>
        {showSkeleton ? (
          <HomePortfolioSkeleton />
        ) : (
          filteredProjects.map(({ project, isInactive }, index) => {
            // Вычисляем позицию в grid на основе индекса
            // Паттерн: каждые 8 элементов повторяется (nth-of-type(8n + 2), 8n + 4, 8n + 5, 8n + 7)
            // В 0-based индексации это: index % 8 === 1, 3, 4, 6
            const cycleIndex = index % 8;
            const isWideItem = cycleIndex === 1 || cycleIndex === 3 || cycleIndex === 4 || cycleIndex === 6;


            // Используем индекс для сохранения порядка элементов в grid
            const card = (
              <article
                className={`${styles.portfolioCard} ${isInactive ? styles.portfolioCardDimmed : ""}`}
                style={{ order: index }}
              >
                <div className={styles.portfolioImageWrapper}>
                  <div className={styles.portfolioImageContainer}>
                    {project.heroImageUrl ? (
                      <Image
                        src={project.heroImageUrl}
                        alt={project.title}
                        className={styles.portfolioImage}
                        loading={index === 0 ? "eager" : "lazy"}
                        fetchPriority={index === 0 ? "high" : undefined}
                        priority={index === 0}
                        fill
                        sizes="(max-width: 640px) 88vw, (max-width: 1200px) 40vw, 22vw"
                        quality={75}
                      />
                    ) : (
                      <span className={styles.portfolioImageFallback} aria-hidden />
                    )}
                  </div>
                  <span className={styles.portfolioTitle}>{project.title}</span>
                </div>
              </article>
            );

            // Создаем стили для сохранения позиции в grid
            const linkStyle: React.CSSProperties = {
              order: index,
              // Явно указываем grid-column для сохранения позиции
              gridColumn: isWideItem ? 'span 2' : 'span 1',
            };

            return (
              <Link
                key={project.slug}
                href={`/${project.slug}`}
                className={styles.portfolioLink}
                style={linkStyle}
                aria-disabled={isInactive}
                tabIndex={isInactive ? -1 : undefined}
                data-inactive={isInactive ? "true" : "false"}
              >
                {card}
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
}

function HomePortfolioSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={`portfolio-skeleton-${index}`} className={styles.portfolioSkeletonCard}>
          <span className={`${styles.skeleton} ${styles.portfolioSkeletonImage}`} />
          <span className={`${styles.skeleton} ${styles.portfolioSkeletonTitle}`} />
        </div>
      ))}
    </>
  );
}
