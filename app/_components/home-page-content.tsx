"use client";

import { SafeImage as Image } from "@/components/safe-image";
import { useMemo, useState } from "react";
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

  const showSkeleton = enrichedProjects.length === 0;

  const toggleMobileCategories = () => {
    setMobileCategoriesOpen((prev) => !prev);
  };

  const handleCategorySelect = (categoryId: ActiveCategory) => {
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

      <div className={styles.portfolioGrid}>
        {showSkeleton ? (
          <HomePortfolioSkeleton />
        ) : (
          filteredProjects.map(({ project, isInactive }, index) => {
            const card = (
              <article
                className={`${styles.portfolioCard} ${isInactive ? styles.portfolioCardDimmed : ""}`}
              >
                <div className={styles.portfolioImageWrapper}>
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
                      quality={70}
                    />
                  ) : (
                    <span className={styles.portfolioImageFallback} aria-hidden />
                  )}
                  <span className={styles.portfolioTitle}>{project.title}</span>
                </div>
              </article>
            );

            return (
              <Link key={project.slug} href={`/${project.slug}`} className={styles.portfolioLink}>
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
